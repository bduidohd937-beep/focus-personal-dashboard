import {validatedData,makeDefaultData} from './data.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './cloud-config.js';
import {equalData,hasPersonalData} from './sync-logic.js';

const META='focus.cloud.meta.v2';
let api=null, client=null, session=null, base=null, rev=0, inflight=false, epoch=0, timer=null, poller=null;
let state={phase:'initializing',email:'',error:'',remote:null,lastSync:0};
const refresh=()=>{if(api)api.refresh();};
function change(patch){state={...state,...patch};refresh();}
function readMeta(){try{return JSON.parse(localStorage.getItem(META)||'null');}catch{return null;}}
function writeMeta(snapshot){try{localStorage.setItem(META,JSON.stringify({userId:session.user.id,revision:rev,snapshot}));}catch{}}
function backup(label,payload){try{localStorage.setItem('focus.cloud.backup.'+label+'.'+Date.now(),JSON.stringify(payload));}catch{}}
function errText(e){return e&&e.message?e.message:'네트워크 또는 인증 오류가 발생했습니다.';}
const remoteValue=async()=>{
  const result=await client.from('focus_sync_state').select('payload,revision,updated_at').eq('user_id',session.user.id).maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)return null;
  return {revision:Number(result.data.revision),payload:validatedData(result.data.payload)};
};
function fromRemote(remote){
  if(!session||!remote)return;
  const local=api.getLocal();
  if(!equalData(local,remote.payload))backup('before-download',local);
  base=remote.payload;rev=remote.revision;
  writeMeta(base);
  api.replaceLocal(remote.payload);
  change({phase:'synced',remote:null,error:'',lastSync:Date.now()});
}
async function begin(nextSession){
  const myEpoch=++epoch;
  session=nextSession;
  clearTimeout(timer);
  if(!session){base=null;rev=0;change({phase:'guest',email:'',remote:null,error:''});return;}
  change({phase:'syncing',email:session.user.email||'',error:'',remote:null});
  try{
    const remote=await remoteValue();
    if(myEpoch!==epoch)return;
    const local=api.getLocal();
    const meta=readMeta();
    if(remote){
      if(meta&&meta.userId===session.user.id&&meta.snapshot){
        const last=validatedData(meta.snapshot);
        base=last;rev=Number(meta.revision)||0;
        if(equalData(local,last)){fromRemote(remote);return;}
        if(remote.revision===rev){base=last;change({phase:'synced',remote:null});schedule();return;}
        change({phase:'choice',remote,error:'기기와 클라우드 양쪽에서 변경된 기록이 있어요. 어느 쪽을 보존할지 선택해 주세요.'});return;
      }
      if(!hasPersonalData(local)){fromRemote(remote);return;}
      change({phase:'choice',remote,error:'처음 연결하는 기기에 별도 기록이 있어요. 자동으로 덮어쓰지 않았습니다.'});return;
    }
    rev=0;base=null;
    if(hasPersonalData(local)){change({phase:'choice',remote:null,error:'이 기기의 기존 기록을 처음 클라우드로 옮길까요?'});return;}
    change({phase:'synced',remote:null,error:''});schedule();
  }catch(e){if(myEpoch===epoch)change({phase:'error',error:errText(e)});}
}
async function getLatest(){
  if(!session||inflight||['choice','guest','initializing'].includes(state.phase)||!navigator.onLine)return;
  try{
    const remote=await remoteValue();
    if(!session)return;
    if(!remote){if(rev===0){schedule();return;}change({phase:'choice',remote:null,error:'클라우드 기록이 없어졌어요. 새로 업로드할지 확인해 주세요.'});return;}
    if(remote.revision===rev){if(base&&!equalData(api.getLocal(),base))schedule();return;}
    if(base&&equalData(api.getLocal(),base)){fromRemote(remote);return;}
    change({phase:'choice',remote,error:'다른 기기에서 기록이 바뀌었고, 이 기기에도 저장되지 않은 변경이 있어요.'});
  }catch(e){change({phase:navigator.onLine?'error':'offline',error:errText(e)});}
}
async function flush(){
  if(!session||inflight||state.phase==='choice')return;
  if(!navigator.onLine){change({phase:'offline',error:'인터넷 연결이 없어 기기에만 저장 중입니다.'});return;}
  const snapshot=api.getLocal();
  if(base&&equalData(snapshot,base)){change({phase:'synced',error:''});return;}
  inflight=true;const myEpoch=epoch;
  change({phase:'syncing',error:''});
  try{
    const {data,error}=await client.rpc('focus_sync_commit',{p_expected_revision:rev,p_payload:snapshot});
    if(error)throw error;
    if(myEpoch!==epoch)return;
    const row=Array.isArray(data)?data[0]:data;
    if(!row||!row.ok){
      inflight=false;
      const latest=await remoteValue();
      if(myEpoch!==epoch)return;
      change({phase:'choice',remote:latest,error:'동시 수정이 감지되어 업로드를 중단했어요. 기록을 확인해 주세요.'});
      return;
    }
    rev=Number(row.current_revision);base=snapshot;writeMeta(snapshot);
    change({phase:'synced',lastSync:Date.now(),error:''});
    if(!equalData(api.getLocal(),snapshot))schedule();
  }catch(e){if(myEpoch===epoch)change({phase:navigator.onLine?'error':'offline',error:errText(e)});}
  finally{inflight=false;}
}
function schedule(){if(!session||state.phase==='choice')return;clearTimeout(timer);timer=setTimeout(flush,650);}
export function localChanged(){if(session) schedule();}
export function badge(){const p=state.phase;return p==='synced'?'● 동기화됨':p==='syncing'?'◌ 동기화 중':p==='choice'?'! 기록 확인 필요':p==='offline'?'○ 오프라인':p==='error'?'! 연결 오류':p==='guest'?'○ 기기 저장':'◌ 준비 중';}
export function cloudPanel(){
  const p=state.phase;
  const header='<div class="cloud-head"><strong>☁ 클라우드 동기화</strong><span class="cloud-badge">'+badge()+'</span></div>';
  if(p==='initializing')return '<section class="card cloud-card">'+header+'<p>로그인 상태를 확인하고 있어요…</p></section>';
  if(p==='guest')return '<section class="card cloud-card">'+header+
   '<p class="cloud-note">이메일로 로그인하면 PC와 갤럭시에서 같은 기록을 사용할 수 있어요. 아직 로그인 전이므로 이 기기에만 저장돼요.</p>'+
   '<form id="cloudAuthForm" class="cloud-form"><label>이메일<input required type="email" name="email" autocomplete="email" placeholder="example@email.com"></label>'+
   '<label>비밀번호<input required minlength="8" type="password" name="password" autocomplete="current-password" placeholder="8자 이상"></label>'+
   '<div class="cloud-actions"><button class="btn primary" type="submit" name="mode" value="signin">로그인</button><button class="btn ghost" type="submit" name="mode" value="signup">회원가입</button></div></form>'+
   '<p class="inline-message">첫 회원가입 시 확인 메일이 올 수 있어요. 메일 링크를 연 뒤 다시 로그인해 주세요.</p></section>';
  let msg=state.error?'<p class="cloud-warning">'+state.error+'</p>':'';
  let body='';
  if(p==='choice'){
   const exists=!!state.remote;
   body='<p class="cloud-note">선택 전 이 기기의 기록과 클라우드 기록은 모두 유지됩니다. 기기 기록은 자동 백업 후 변경됩니다.</p>'+
    '<div class="cloud-actions"><button class="btn primary" data-action="cloud-use-local">'+(exists?'이 기기 기록을 클라우드에 적용':'이 기기 기록 업로드')+'</button>'+
    (exists?'<button class="btn ghost" data-action="cloud-use-remote">클라우드 기록 가져오기</button>':'')+'</div>';
  }else if(p==='synced')body='<p class="cloud-note">마지막으로 확인된 기록이 계정에 연결되어 있어요. 다른 기기에서는 같은 계정으로 로그인하세요. 변경 사항은 약 20초마다 확인해요.</p>';
  else body='<p class="cloud-note">연결에 실패했거나 업로드 중입니다. 현재 체크 기록은 이 기기에 계속 보관돼요.</p><button class="btn ghost" data-action="cloud-retry">다시 연결</button>';
  return '<section class="card cloud-card">'+header+'<p class="cloud-email">'+(state.email||'로그인됨')+'</p>'+msg+body+
   '<div class="cloud-footer"><button class="muted-btn" data-action="cloud-signout">로그아웃</button></div></section>';
}
export async function authSubmit(form,mode){
  if(!client)return;
  const email=String(form.elements.namedItem('email').value||'').trim();
  const password=String(form.elements.namedItem('password').value||'');
  if(!email||password.length<8){api.notify('이메일과 8자 이상 비밀번호를 입력해 주세요.');return;}
  change({phase:'initializing',error:''});
  try{
    const result=mode==='signup'
      ?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname+'#settings'}})
      :await client.auth.signInWithPassword({email,password});
    if(result.error)throw result.error;
    if(mode==='signup'&&!result.data.session){change({phase:'guest'});api.notify('회원가입 요청 완료. 메일 인증 후 로그인해 주세요.');}
    else api.notify(mode==='signup'?'회원가입 완료':'로그인 완료');
  }catch(e){change({phase:'guest',error:errText(e)});api.notify(errText(e));}
}
export async function cloudAction(action){
  if(action==='cloud-signout'){try{await client?.auth.signOut();await begin(null);}catch(e){api.notify(errText(e));}return;}
  if(action==='cloud-retry'){if(session)await begin(session);else if(!client)await initCloud(api);else {const r=await client.auth.getSession();if(r.error)throw r.error;await begin(r.data.session);}return;}
  if(state.phase!=='choice'||!session)return;
  if(action==='cloud-use-remote'){
    if(!state.remote)return;
    if(!confirm('기기 기록을 자동 백업하고 클라우드 기록을 불러올까요? 이 기기의 표시 내용이 변경됩니다.'))return;
    fromRemote(state.remote);return;
  }
  if(action==='cloud-use-local'){
    const remote=state.remote;
    const detail=remote?'기존 클라우드 기록이 교체됩니다. 클라우드의 이전 내용도 이 기기에 백업됩니다. 계속할까요?':'이 기기의 현재 기록을 새 클라우드에 업로드할까요?';
    if(!confirm(detail))return;
    if(remote)backup('before-cloud-replace',remote.payload);
    rev=remote?remote.revision:0;base=remote?remote.payload:null;
    change({phase:'syncing',remote:null,error:''});
    await flush();
  }
}
export async function initCloud(handlers){
  api=handlers;
  if(!navigator.onLine){change({phase:'offline',error:'현재 오프라인입니다. 연결되면 로그인을 다시 확인할게요.'});window.addEventListener('online',()=>initCloud(handlers),{once:true});return;}
  try{
    const mod=await import('https://esm.sh/@supabase/supabase-js@2.57.2?bundle');
    client=mod.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{headers:{'x-application-name':'focus-v2'}}});
    client.auth.onAuthStateChange((event,s)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))setTimeout(()=>{if((s?.user?.id||null)!==(session?.user?.id||null))begin(s);},0);});
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    await begin(data.session);
  }catch(e){change({phase:'error',error:errText(e)});}
  if(poller)clearInterval(poller);
 poller=setInterval(()=>{if(session)getLatest();},20000);
  window.addEventListener('online',()=>{if(session)getLatest();});
  window.addEventListener('focus',()=>{if(session)getLatest();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)getLatest();});
}
