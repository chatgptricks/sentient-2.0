import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {validateComment} from './worker.mjs';
const note = {id:crypto.randomUUID(),page:'home',author:'Reviewer',message:'Change this headline.',anchor:{selector:'main > section:nth-of-type(1)',quote:'Headline',x:.5,y:.5,pageY:.1}};
test('validates untrusted notes and anchors',()=>{
  assert.equal(validateComment(note).author,'Reviewer');
  for (const input of [null,[],{...note,page:'unknown'},{...note,author:' '},{...note,message:'x'.repeat(2001)},{...note,id:'bad'},{...note,anchor:{...note.anchor,x:NaN}},{...note,anchor:{...note.anchor,y:2}},{...note,anchor:{...note.anchor,selector:'x'.repeat(1001)}}]) assert.equal(validateComment(input),null);
});
const env={ALLOWED_ORIGINS:'https://chatgptricks.github.io'};
const req=(method,body,origin='https://chatgptricks.github.io')=>new Request('https://api.example/comments?page=home',{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('blocks foreign origins before accessing storage',async()=>assert.equal((await worker.fetch(req('POST',note,'https://evil.example'),env)).status,403));
test('handles CORS preflight',async()=>{const r=await worker.fetch(req('OPTIONS'),env);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://chatgptricks.github.io');});
test('rate limits and rejects oversized requests',async()=>{
  assert.equal((await worker.fetch(req('POST',note),{...env,COMMENT_RATE:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await worker.fetch(req('POST',{...note,message:'x'.repeat(17000)}),env)).status,413);
});
test('does not report success on a failed save',async()=>{const r=await worker.fetch(req('POST',note),{...env,DB:{prepare(){throw new Error('offline');}}});assert.equal(r.status,503);});
