import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONFIG = {
  supabaseUrl: window.SOULCHAT_SUPABASE_URL || "",
  supabaseAnonKey: window.SOULCHAT_SUPABASE_ANON_KEY || "",
  conversationId: window.SOULCHAT_CONVERSATION_ID || "",
};
const $ = (id) => document.getElementById(id);
const authScreen=$("auth-screen"), chatScreen=$("chat-screen"), authMessage=$("auth-message");
let supabase=null, currentUser=null, channel=null, toastTimer=null;

function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800)}
function setAuthMessage(message,error=false){authMessage.textContent=message;authMessage.style.color=error?"#e9a0aa":"var(--muted)"}
function formatTime(value){return new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(value))}
function renderMessage(message){
  const empty=$("message-list").querySelector(".empty-state");if(empty)empty.remove();
  const node=document.createElement("article");node.className="message"+(message.sender_id===currentUser.id?" mine":"");
  if(message.message_type==="image"&&message.media_url){const img=document.createElement("img");img.src=message.media_url;img.alt="Shared image";img.loading="lazy";node.append(img)}
  else {const p=document.createElement("p");p.textContent=message.content||"";node.append(p)}
  const time=document.createElement("time");time.textContent=formatTime(message.created_at);node.append(time);
  node.dataset.messageId=message.id;$("message-list").append(node);$("message-list").scrollTop=$("message-list").scrollHeight;
}
function showChat(user){currentUser=user;authScreen.classList.add("hidden");chatScreen.classList.remove("hidden")}
function showLogin(){chatScreen.classList.add("hidden");authScreen.classList.remove("hidden")}
async function loadMessages(){
  if(!CONFIG.conversationId){$("connection-status").textContent="Setup required";toast("Add your Supabase project configuration to connect messaging.");return}
  const {data,error}=await supabase.from("messages").select("*").eq("conversation_id",CONFIG.conversationId).order("created_at",{ascending:true}).limit(60);
  if(error){$("connection-status").textContent="Unable to load messages";toast(error.message);return}
  $("message-list").innerHTML="";if(!data?.length){$("message-list").innerHTML='<div class="empty-state"><div class="empty-orbit">♡</div><h3>Your story starts here.</h3><p>Send the first little hello.</p></div>';return}
  data.forEach(renderMessage);
}
function subscribe(){
  if(!CONFIG.conversationId)return;
  if(channel)supabase.removeChannel(channel);
  channel=supabase.channel("soulchat:"+CONFIG.conversationId)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+CONFIG.conversationId},payload=>renderMessage(payload.new))
    .subscribe(status=>{$("connection-status").textContent=status==="SUBSCRIBED"?"Connected securely":status==="CHANNEL_ERROR"?"Connection issue":"Connecting securely…"});
}
async function sendMessage(content,type="text",mediaUrl=null){
  const payload={conversation_id:CONFIG.conversationId,sender_id:currentUser.id,message_type:type,content,media_url:mediaUrl};
  const {error}=await supabase.from("messages").insert(payload);if(error)throw error;
}
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!supabase){setAuthMessage("Messaging setup is not connected yet. Ask the project owner to configure Supabase.",true);return}
  const button=e.currentTarget.querySelector("button");button.disabled=true;button.textContent="Entering…";
  const {data,error}=await supabase.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  button.disabled=false;button.innerHTML='Enter SoulChat <span>↗</span>';
  if(error){setAuthMessage(error.message,true);return}
  showChat(data.user);await loadMessages();subscribe();
});
$("logout-btn").addEventListener("click",async()=>{if(supabase)await supabase.auth.signOut();if(channel)supabase.removeChannel(channel);currentUser=null;showLogin()});
$("composer").addEventListener("submit",async e=>{
  e.preventDefault();const input=$("message-input"),content=input.value.trim();if(!content)return;
  if(!supabase||!currentUser||!CONFIG.conversationId){toast("Chat is not connected yet.");return}
  input.disabled=true;try{await sendMessage(content);input.value=""}catch(err){toast("Message not sent: "+err.message)}finally{input.disabled=false;input.focus()}
});
$("attach-btn").addEventListener("click",()=>{if(!supabase||!currentUser||!CONFIG.conversationId){toast("Connect SoulChat storage first.");return}$("file-input").click()});
$("file-input").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){toast("Please choose an image file.");return}
  if(file.size>8*1024*1024){toast("Image must be smaller than 8 MB.");return}
  const path=currentUser.id+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const {error}=await supabase.storage.from("chat-media").upload(path,file,{contentType:file.type,upsert:false});
  if(error){toast("Upload failed: "+error.message);return}
  const {data}=supabase.storage.from("chat-media").getPublicUrl(path);
  try{await sendMessage("", "image", data.publicUrl);toast("Image shared.")}catch(err){toast("Image uploaded but message failed: "+err.message)}
  e.target.value="";
});
$("details-btn").addEventListener("click",()=>$("details-panel").classList.remove("hidden"));
$("close-details").addEventListener("click",()=>$("details-panel").classList.add("hidden"));
$("theme-btn").addEventListener("click",()=>document.body.classList.toggle("light"));

async function init(){
  if(!CONFIG.supabaseUrl||!CONFIG.supabaseAnonKey){setAuthMessage("Private access · Supabase connection needs configuration");return}
  supabase=createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
  const {data}=await supabase.auth.getSession();
  if(data.session){showChat(data.session.user);await loadMessages();subscribe()}
  supabase.auth.onAuthStateChange(async(_event,session)=>{
    if(session&&!currentUser){showChat(session.user);await loadMessages();subscribe()}
    if(!session&&currentUser){currentUser=null;showLogin()}
  });
}
init();
