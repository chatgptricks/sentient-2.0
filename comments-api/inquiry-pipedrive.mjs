import { inquiryText } from './inquiries.mjs';

const crmOrigin = 'https://sentient.pipedrive.com';
const retryInterval = 5 * 60 * 1000;
const leaseDuration = 90 * 1000;
const rejectedWriteStatuses = new Set([400, 401, 403, 404, 405, 413, 415, 422, 429]);
const isNumberId = value => Number.isSafeInteger(value) && value > 0;
const isLeadId = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const timestamp = (offset = 0) => new Date(Date.now() + offset).toISOString();

class PipedriveError extends Error {
  constructor(code, rejected = false) {
    super(code);
    this.rejected = rejected;
  }
}

async function requestPipedrive(token, path, {query, body} = {}) {
  const url = new URL(path, crmOrigin);
  if (query) url.search = new URLSearchParams(query).toString();
  let response;
  try {
    response = await fetch(url, {
      headers: {'x-api-token': token, 'Content-Type': 'application/json'},
      method: body ? 'POST' : 'GET',
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new PipedriveError('REQUEST_UNCONFIRMED');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new PipedriveError(`HTTP_${response.status}`, rejectedWriteStatuses.has(response.status));
  }
  const result = await response.json().catch(() => null);
  if (result?.success !== true || !Object.hasOwn(result, 'data')) throw new PipedriveError('RESPONSE_UNCONFIRMED');
  return result.data;
}

function findRecord(records, matches) {
  if (records === null) return undefined;
  if (!Array.isArray(records)) throw new PipedriveError('RESPONSE_UNCONFIRMED');
  return records.find(matches);
}

function noteHtml(inquiry) {
  return inquiryText(inquiry).replace(/[&<>]/g, value => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[value]).replace(/\r?\n/g, '<br>');
}

async function syncInquiry(db, token, id, contacts) {
  const now = timestamp();
  const job = await db.prepare(`UPDATE inquiry_pipedrive SET lease_until=?, attempt_count=attempt_count+1
    WHERE inquiry_id=? AND synced_at IS NULL AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<=?)
    RETURNING lease_until, attempt_count, person_id, lead_id, pending_write`)
    .bind(timestamp(leaseDuration), id, now, now).first();
  if (!job) return;

  const saveProgress = async () => {
    const result = await db.prepare(`UPDATE inquiry_pipedrive SET person_id=?, lead_id=?, pending_write=?
      WHERE inquiry_id=? AND lease_until=?`)
      .bind(job.person_id, job.lead_id, job.pending_write, id, job.lease_until).run();
    if (result.meta.changes !== 1) throw new PipedriveError('CLAIM_EXPIRED');
  };
  const create = async (step, path, body, isId) => {
    // Persist intent before writing. An interrupted POST must be reconciled before it can be repeated.
    job.pending_write = step;
    await saveProgress();
    try {
      const result = await requestPipedrive(token, path, {body});
      if (!isId(result?.id)) throw new PipedriveError('RESPONSE_UNCONFIRMED');
      return result.id;
    } catch (error) {
      if (error.rejected) {
        job.pending_write = null;
        await saveProgress();
      }
      throw error;
    }
  };

  try {
    const row = await db.prepare('SELECT payload_json, created_at FROM inquiries WHERE id=?').bind(id).first();
    const inquiry = {...JSON.parse(row.payload_json), id};
    const email = inquiry.email.toLowerCase();
    if (!job.person_id) {
      let personId = contacts.get(email);
      if (!personId) {
        const data = await requestPipedrive(token, '/api/v2/persons/search', {
          query: {term: inquiry.email, fields: 'email', exact_match: true, limit: 1},
        });
        const match = findRecord(data?.items, result => isNumberId(result?.item?.id));
        personId = match?.item.id;
      }
      if (!personId) {
        if (job.pending_write === 'person') throw new PipedriveError('PERSON_UNCONFIRMED');
        personId = await create('person', '/api/v2/persons', {
          name: inquiry.name.slice(0, 120), emails: [{value: inquiry.email, primary: true, label: 'work'}],
        }, isNumberId);
      }
      job.person_id = personId;
      job.pending_write = null;
      await saveProgress();
    }
    contacts.set(email, job.person_id);

    if (!job.lead_id) {
      if (job.pending_write === 'lead') {
        const leads = await requestPipedrive(token, '/api/v1/leads', {
          query: {person_id: job.person_id, limit: 100, updated_since: new Date(Date.parse(row.created_at) - 60000).toISOString()},
        });
        const match = findRecord(leads, lead => lead?.origin_id === id && isLeadId(lead.id));
        if (!match) throw new PipedriveError('LEAD_UNCONFIRMED');
        job.lead_id = match.id;
      } else {
        job.lead_id = await create('lead', '/api/v1/leads', {
          title: `${inquiry.company.slice(0, 160)} · Website inquiry`, person_id: job.person_id, origin_id: id,
        }, isLeadId);
      }
      job.pending_write = null;
      await saveProgress();
    }

    if (job.pending_write === 'note') {
      const notes = await requestPipedrive(token, '/api/v1/notes', {query: {lead_id: job.lead_id, limit: 100}});
      if (!findRecord(notes, note => typeof note?.content === 'string' && note.content.includes(`Reference: ${id}`))) {
        throw new PipedriveError('NOTE_UNCONFIRMED');
      }
    } else {
      await create('note', '/api/v1/notes', {
        lead_id: job.lead_id, pinned_to_lead_flag: 1, content: noteHtml(inquiry),
      }, isNumberId);
    }
    await db.prepare(`UPDATE inquiry_pipedrive SET synced_at=?, lease_until=NULL, pending_write=NULL, last_error=NULL
      WHERE inquiry_id=? AND lease_until=?`).bind(timestamp(), id, job.lease_until).run();
  } catch (error) {
    const delay = retryInterval * 2 ** Math.min(job.attempt_count - 1, 6);
    await db.prepare(`UPDATE inquiry_pipedrive SET next_attempt_at=?, lease_until=NULL, last_error=?
      WHERE inquiry_id=? AND lease_until=?`)
      .bind(timestamp(delay), error instanceof PipedriveError ? error.message : 'SYNC_ERROR', id, job.lease_until).run();
  }
}

export async function syncPipedriveInquiries(env) {
  const token = env.PIPEDRIVE_API_TOKEN?.trim();
  if (!token) return;
  const now = timestamp();
  const {results} = await env.DB.prepare(`SELECT inquiry_id FROM inquiry_pipedrive
    WHERE synced_at IS NULL AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<=?)
    ORDER BY next_attempt_at, inquiry_id LIMIT 5`).bind(now, now).all();
  const contacts = new Map();
  for (const {inquiry_id} of results) await syncInquiry(env.DB, token, inquiry_id, contacts);
}
