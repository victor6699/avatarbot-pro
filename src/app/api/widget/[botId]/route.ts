// GET /api/widget/[botId] — Returns embeddable chat widget JS
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/db/server'

export async function GET(req: NextRequest, { params }: { params: { botId: string } }) {
  const supabase = await createAdminClient()
  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, persona_name, welcome_message, avatar_type, avatar_template_id')
    .eq('id', params.botId)
    .eq('status', 'active')
    .single()

  if (!chatbot) {
    return new NextResponse('// Chatbot not found or inactive', { headers: { 'Content-Type': 'application/javascript' } })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const config = {
    botId: chatbot.id,
    botName: chatbot.persona_name,
    welcomeMessage: chatbot.welcome_message,
    apiUrl: `${appUrl}/api/chat`,
    primaryColor: '#2563eb',
  }

  const widgetScript = `
(function() {
  var CONFIG = ${JSON.stringify(config)};
  var convId = null;
  var history = [];
  var isOpen = false;

  // Inject styles
  var style = document.createElement('style');
  style.textContent = \`
    #ab-widget-btn { position:fixed; bottom:24px; right:24px; width:56px; height:56px; border-radius:50%; background:${config.primaryColor}; color:#fff; border:none; cursor:pointer; box-shadow:0 4px 16px rgba(0,0,0,.2); display:flex; align-items:center; justify-content:center; font-size:24px; z-index:9999; transition:transform .2s; }
    #ab-widget-btn:hover { transform:scale(1.08); }
    #ab-widget-panel { position:fixed; bottom:90px; right:24px; width:360px; height:520px; background:#fff; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,.15); display:none; flex-direction:column; z-index:9998; overflow:hidden; font-family:system-ui,sans-serif; }
    #ab-widget-panel.open { display:flex; }
    #ab-header { background:${config.primaryColor}; color:#fff; padding:16px; font-weight:600; font-size:15px; }
    #ab-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
    .ab-msg { max-width:80%; padding:10px 14px; border-radius:12px; font-size:14px; line-height:1.5; }
    .ab-msg.user { align-self:flex-end; background:${config.primaryColor}; color:#fff; border-bottom-right-radius:4px; }
    .ab-msg.bot { align-self:flex-start; background:#f1f5f9; color:#1e293b; border-bottom-left-radius:4px; }
    #ab-input-row { padding:12px; border-top:1px solid #e2e8f0; display:flex; gap:8px; }
    #ab-input { flex:1; border:1px solid #cbd5e1; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; }
    #ab-send { background:${config.primaryColor}; color:#fff; border:none; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:14px; }
  \`;
  document.head.appendChild(style);

  // Widget HTML
  var panel = document.createElement('div'); panel.id = 'ab-widget-panel';
  panel.innerHTML = '<div id="ab-header">💬 ' + CONFIG.botName + '</div><div id="ab-messages"></div><div id="ab-input-row"><input id="ab-input" placeholder="請輸入訊息..." /><button id="ab-send">送出</button></div>';
  document.body.appendChild(panel);

  var btn = document.createElement('button'); btn.id = 'ab-widget-btn'; btn.innerHTML = '💬';
  document.body.appendChild(btn);

  var messages = panel.querySelector('#ab-messages');

  function addMsg(text, role) {
    var d = document.createElement('div'); d.className = 'ab-msg ' + role; d.textContent = text;
    messages.appendChild(d); messages.scrollTop = messages.scrollHeight;
  }

  function addTyping() {
    var d = document.createElement('div'); d.className = 'ab-msg bot'; d.id = 'ab-typing'; d.textContent = '…';
    messages.appendChild(d); messages.scrollTop = messages.scrollHeight;
  }

  addMsg(CONFIG.welcomeMessage, 'bot');

  async function sendMessage(text) {
    if (!text.trim()) return;
    addMsg(text, 'user'); history.push({ role:'user', content:text });
    addTyping();
    try {
      var res = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatbot_id: CONFIG.botId, conversation_id: convId, history: history.slice(-8) })
      });
      var data = await res.json();
      document.getElementById('ab-typing')?.remove();
      addMsg(data.answer, 'bot');
      convId = data.conversation_id;
      history.push({ role:'assistant', content:data.answer });
    } catch(e) {
      document.getElementById('ab-typing')?.remove();
      addMsg('抱歉，服務暫時無法使用，請稍後再試。', 'bot');
    }
  }

  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    btn.innerHTML = isOpen ? '✕' : '💬';
  });

  panel.querySelector('#ab-send').addEventListener('click', function() {
    var input = document.getElementById('ab-input');
    sendMessage(input.value); input.value = '';
  });

  panel.querySelector('#ab-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { sendMessage(e.target.value); e.target.value = ''; }
  });
})();
`

  return new NextResponse(widgetScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
