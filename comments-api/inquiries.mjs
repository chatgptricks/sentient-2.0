const budgets = new Set(['Under $20,000','$20,000–$50,000','$50,000–$100,000','$100,000–$250,000','$250,000+','Let’s discuss']);
const stages = new Set(['Pre-launch','Early stage','Growth stage','Established']);
const frequencies = new Set(['Weekly','Monthly','Quarterly','Still planning']);
const fields = ['name','company','email','description','budget','stage','service','launchDate','frequency'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bodyLimit = 16000;
const sendDeadline = 10000;
const resendWindow = 23 * 60 * 60 * 1000;
const definiteCloudflareRejections = new Set([
  'E_VALIDATION_ERROR','E_FIELD_MISSING','E_TOO_MANY_RECIPIENTS','E_TOO_MANY_ATTACHMENTS',
  'E_SENDER_NOT_VERIFIED','E_RECIPIENT_NOT_ALLOWED','E_RECIPIENT_SUPPRESSED','E_ACCOUNT_SUSPENDED',
  'E_SENDER_DOMAIN_NOT_AVAILABLE','E_CONTENT_TOO_LARGE','E_RATE_LIMIT_EXCEEDED','E_DAILY_LIMIT_EXCEEDED',
  'E_HEADER_NOT_ALLOWED','E_HEADER_USE_API_FIELD','E_HEADER_VALUE_INVALID','E_HEADER_VALUE_TOO_LONG',
  'E_HEADER_NAME_INVALID','E_HEADERS_TOO_LARGE','E_HEADERS_TOO_MANY',
]);

export function validateInquiry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !uuid.test(data.id || '')) return null;
  const lead = Object.fromEntries(fields.map(key => [key,typeof data[key] === 'string' ? data[key].trim() : '']));
  if (Object.values(lead).some(value => value.length > 2000)) return null;
  if (!lead.name || !lead.company || !lead.description || !email.test(lead.email)
    || !budgets.has(lead.budget) || !stages.has(lead.stage) || !['campaign','launch','growth'].includes(lead.service)) return null;
  if ([lead.name,lead.company,lead.email].some(value => /[\u0000-\u001f\u007f]/.test(value))) return null;
  if (lead.service === 'launch' && (!/^\d{4}-\d{2}-\d{2}$/.test(lead.launchDate) || !Number.isFinite(Date.parse(lead.launchDate)) || new Date(lead.launchDate).toISOString().slice(0,10) !== lead.launchDate)) return null;
  if (lead.service === 'growth' && !frequencies.has(lead.frequency)) return null;
  if (lead.service !== 'launch') lead.launchDate = '';
  if (lead.service !== 'growth') lead.frequency = '';
  return {id:data.id.toLowerCase(),...lead};
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error('Invalid request.'),{status:400});
  const chunks = [];
  let size = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > bodyLimit) { await reader.cancel(); throw Object.assign(new Error('Your request is too long.'),{status:413}); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function deliveryConfig(env) {
  const from = typeof env.INQUIRY_FROM === 'string' ? env.INQUIRY_FROM.trim() : '';
  const to = typeof env.INQUIRY_TO === 'string' ? env.INQUIRY_TO.trim() : '';
  if (!email.test(from) || !email.test(to) || /[\r\n]/.test(from+to)) return null;
  const provider = env.INQUIRY_DELIVERY_PROVIDER || (env.INQUIRY_EMAIL?.send ? 'cloudflare' : '');
  if (provider === 'cloudflare' && typeof env.INQUIRY_EMAIL?.send === 'function') return {provider,from,to};
  if (provider === 'resend' && env.RESEND_API_KEY) return {provider,from,to};
  return null;
}

export function inquiryEmail(lead,config) {
  const service = {campaign:'Campaign',launch:'Viral launch',growth:'Growth'}[lead.service];
  const text = [
    'A new Sentient website inquiry was received.',
    '',`Reference: ${lead.id}`,`Name: ${lead.name}`,`Company: ${lead.company}`,
    `Email: ${lead.email}`,`Service: ${service}`,`Budget: ${lead.budget}`,`Stage: ${lead.stage}`,
    ...(lead.launchDate ? [`Planned launch: ${lead.launchDate}`] : []),
    ...(lead.frequency ? [`Launch frequency: ${lead.frequency}`] : []),
    '','Brief:',lead.description,
  ].join('\n');
  return {from:config.from,to:config.to,subject:`Sentient website inquiry · ${service} · ${lead.company.slice(0,120)}`,text,replyTo:lead.email,headers:{'X-Inquiry-ID':lead.id}};
}

async function sendNotification(lead,env,config) {
  const message = inquiryEmail(lead,config);
  if (config.provider === 'cloudflare') {
    try {
      const result = await env.INQUIRY_EMAIL.send(message);
      if (typeof result?.messageId !== 'string' || !result.messageId || result.messageId.length > 200) return {status:'uncertain',errorCode:'PROVIDER_RESPONSE_UNCONFIRMED'};
      return {status:'accepted',messageId:result.messageId};
    } catch (error) {
      const code = typeof error?.code === 'string' && /^E_[A-Z0-9_]{1,70}$/.test(error.code) ? error.code : 'PROVIDER_REQUEST_UNCONFIRMED';
      return {status:definiteCloudflareRejections.has(code) ? 'failed' : 'uncertain',errorCode:code};
    }
  }
  try {
    const response = await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`inquiry/${lead.id}`},
      body:JSON.stringify({from:message.from,to:[message.to],subject:message.subject,text:message.text,reply_to:message.replyTo,headers:message.headers}),
      signal:AbortSignal.timeout(sendDeadline),redirect:'error',
    });
    if (!response.ok) return {status:[400,401,403,404,405,413,422,429].includes(response.status) ? 'failed' : 'uncertain',errorCode:`PROVIDER_HTTP_${response.status}`};
    const result = await response.json();
    if (typeof result?.id !== 'string' || !result.id || result.id.length > 200) return {status:'uncertain',errorCode:'PROVIDER_RESPONSE_UNCONFIRMED'};
    return {status:'accepted',messageId:result.id};
  } catch { return {status:'uncertain',errorCode:'PROVIDER_REQUEST_UNCONFIRMED'}; }
}

function receipt(row,configured) {
  const notificationStatus = row.delivery_status === 'accepted' ? 'accepted'
    : row.delivery_status === 'sending' ? 'pending'
    : row.delivery_status === 'saved' ? configured ? 'pending' : 'not_configured'
    : row.delivery_status;
  const message = notificationStatus === 'accepted'
    ? 'Your request is saved and the team notification has been sent.'
    : 'Your request is saved. Email notification is currently unavailable.';
  return {id:row.id,saved:true,notificationStatus,message};
}

function htmlReceipt(status,body,json) {
  const escape = value => String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const title = body.saved ? body.notificationStatus === 'accepted' ? 'Your request is sent.' : 'Your request is saved.' : 'Please check your request.';
  const headers = new Headers(json(status,{}).headers);
  headers.set('Content-Type','text/html; charset=utf-8');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(title)} — Sentient</title><style>html{color-scheme:dark}body{margin:0;background:#0b0c09;color:#f5f5eb;font:16px/1.6 Arial,sans-serif}main{max-width:620px;margin:12vh auto;padding:28px}small{color:#b9c0a8;letter-spacing:.14em}h1{font-size:clamp(36px,7vw,60px);line-height:1.08;letter-spacing:-.045em}p{color:#c8cdbd}a{display:inline-block;margin-top:24px;padding:14px 22px;border-radius:999px;background:#d4ff00;color:#111;text-decoration:none;font-weight:700}.reference{font-size:12px;overflow-wrap:anywhere}</style></head><body><main><small>SENTIENT</small><h1>${escape(title)}</h1><p>${escape(body.message || body.error || 'Please try again shortly.')}</p>${body.id ? `<p class="reference">Reference: ${escape(body.id)}</p>` : ''}<a href="https://chatgptricks.github.io/sentient-2.0/">Back to Sentient ↗</a></main></body></html>`;
  return new Response(html,{status,headers});
}

async function notify(row,lead,env,config,ctx) {
  const now = new Date().toISOString();
  const attempt = crypto.randomUUID();
  const retryAfter = new Date(Date.now()-30000).toISOString();
  const retryWindow = new Date(Date.now()-resendWindow).toISOString();
  const claim = await env.DB.prepare(`UPDATE inquiries SET delivery_status='sending', delivery_provider=?, delivery_attempt_id=?,
    delivery_started_at=?, delivery_first_attempt_at=COALESCE(delivery_first_attempt_at,?), updated_at=?, delivery_error_code=NULL
    WHERE id=? AND (delivery_status='saved' OR (delivery_status='failed' AND delivery_uncertain_at IS NULL) OR
      (?='resend' AND delivery_provider='resend' AND delivery_first_attempt_at>=? AND
        (delivery_status IN ('uncertain','failed') OR (delivery_status='sending' AND delivery_started_at<=?))))`)
    .bind(config.provider,attempt,now,now,now,lead.id,config.provider,retryWindow,retryAfter).run();
  if (claim.meta.changes !== 1) {
    // Cloudflare has no documented idempotency key. An interrupted attempt may
    // already have queued mail, so never automatically send it again.
    if (row.delivery_status === 'sending' && row.delivery_started_at <= retryAfter) {
      await env.DB.prepare("UPDATE inquiries SET delivery_status='uncertain', delivery_uncertain_at=COALESCE(delivery_uncertain_at,?), delivery_error_code='SEND_RESULT_UNCONFIRMED', updated_at=? WHERE id=? AND delivery_status='sending' AND delivery_started_at<=?").bind(now,now,lead.id,retryAfter).run();
    }
    return;
  }
  const task = (async () => {
    const result = await sendNotification(lead,env,config);
    await env.DB.prepare(`UPDATE inquiries SET delivery_status=?, provider_message_id=?, delivery_error_code=?,
      delivery_uncertain_at=CASE WHEN ?='uncertain' THEN COALESCE(delivery_uncertain_at,?) ELSE delivery_uncertain_at END,
      delivery_accepted_at=?, updated_at=? WHERE id=? AND delivery_attempt_id=?`)
      .bind(result.status,result.messageId || null,result.errorCode || null,result.status,new Date().toISOString(),result.status === 'accepted' ? new Date().toISOString() : null,new Date().toISOString(),lead.id,attempt).run();
  })();
  // Retain the actual provider result if a browser disconnects or times out.
  ctx?.waitUntil?.(task.catch(() => {}));
  let timer;
  try {
    await Promise.race([task,new Promise((_,reject) => {timer=setTimeout(() => reject(new Error('Send result pending.')),sendDeadline);})]);
  } catch {
    await env.DB.prepare("UPDATE inquiries SET delivery_status='uncertain', delivery_uncertain_at=COALESCE(delivery_uncertain_at,?), delivery_error_code='SEND_RESULT_UNCONFIRMED', updated_at=? WHERE id=? AND delivery_attempt_id=? AND delivery_status='sending'")
      .bind(new Date().toISOString(),new Date().toISOString(),lead.id,attempt).run();
  } finally {clearTimeout(timer);}
}

export async function handleInquiry(request,env,json,originAllowed,ctx) {
  const type = request.headers.get('Content-Type') || '';
  const native = type.startsWith('application/x-www-form-urlencoded');
  const respond = (status,body) => native ? htmlReceipt(status,body,json) : json(status,body);
  if (request.method !== 'POST') return respond(405,{error:'Use POST for a request.'});
  if (!originAllowed) return respond(403,{error:'Origin required.'});
  if (new URL(request.url).search) return respond(400,{error:'This endpoint does not accept query parameters.'});
  if (!type.startsWith('application/json') && !native) return respond(415,{error:'Use JSON or form data.'});
  try {
    if (typeof env.INQUIRY_RATE?.limit !== 'function') return respond(503,{error:'Contact requests are temporarily unavailable. Please try again.'});
    if (!(await env.INQUIRY_RATE.limit({key:request.headers.get('CF-Connecting-IP') || 'unknown'})).success) return respond(429,{error:'Too many requests. Please wait a minute before trying again.'});
  } catch { return respond(503,{error:'Contact requests are temporarily unavailable. Please try again.'}); }
  let data;
  try {const body=await readBody(request);data=type.startsWith('application/json') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));}
  catch (error) {return respond(error.status || 400,{error:error.status === 413 ? 'Your request is too long.' : 'Invalid request.'});}
  if (native && !data.id) data.id = crypto.randomUUID();
  const lead = validateInquiry(data);
  if (!lead) return respond(400,{error:'Complete all required fields with a valid email address and request ID.'});
  const key = request.headers.get('Idempotency-Key');
  if (key && key.toLowerCase() !== lead.id) return respond(400,{error:'The request ID does not match.'});
  try {
    const {id,...payload} = lead;
    const encoded = JSON.stringify(payload);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(encoded)))].map(value=>value.toString(16).padStart(2,'0')).join('');
    const now = new Date().toISOString();
    const created = await env.DB.prepare('INSERT OR IGNORE INTO inquiries (id,payload_hash,payload_json,created_at,updated_at) VALUES (?,?,?,?,?)').bind(id,hash,encoded,now,now).run();
    let row = await env.DB.prepare('SELECT * FROM inquiries WHERE id=?').bind(id).first();
    if (!row) throw new Error('Save unconfirmed.');
    if (row.payload_hash !== hash) return respond(409,{error:'This request ID is already used for a different brief. Create a new request ID for changed details.'});
    const config = deliveryConfig(env);
    if (config && row.delivery_status !== 'accepted') {
      await notify(row,lead,env,config,ctx);
      row = await env.DB.prepare('SELECT * FROM inquiries WHERE id=?').bind(id).first();
    }
    const result = receipt(row,Boolean(config));
    return respond(result.notificationStatus === 'accepted' ? created.meta.changes === 1 ? 201 : 200 : 202,result);
  } catch {
    return respond(503,{error:'We could not confirm your request. Please retry with the same request ID.'});
  }
}
