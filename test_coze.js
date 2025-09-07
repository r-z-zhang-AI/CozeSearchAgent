const axios = require('axios');

// 测试Coze API调用
async function testCozeAPI() {
  const COZE_TOKEN = process.env.COZE_TOKEN || 'your_token_here';
  
  if (!COZE_TOKEN || COZE_TOKEN === 'your_token_here') {
    console.error('请设置 COZE_TOKEN 环境变量');
    return;
  }

  const url = 'https://api.coze.cn/v3/chat';
  const headers = {
    Authorization: `Bearer ${COZE_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const body = {
    bot_id: '7537877620181041204',
    user_id: 'test_user',
    stream: false,
    auto_save_history: true,
    conversation_id: 'c_1757073103657_a2jr36k7o',
    additional_messages: [
      {
        content: "新能源电池热管理需要顾问，推荐3位",
        content_type: "text",
        role: "user",
        type: "question"
      }
    ]
  };

  try {
    console.log('=== 测试 Coze API 调用 ===');
    console.log('请求URL:', url);
    console.log('请求体:', JSON.stringify(body, null, 2));
    
    const resp = await axios.post(url, body, { 
      headers: headers, 
      timeout: 30000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    console.log('=== API 响应 ===');
    console.log('HTTP状态:', resp.status);
    console.log('响应数据:', JSON.stringify(resp.data, null, 2));
    
    if (resp.status === 200 && resp.data?.data?.id) {
      const chat_id = resp.data.data.id;
      console.log('获取到 chat_id:', chat_id);
      
      // 查询消息
      setTimeout(async () => {
        try {
          const messagesResp = await axios.get(`https://api.coze.cn/v3/chat/message/list?chat_id=${chat_id}&conversation_id=c_1757073103657_a2jr36k7o`, {
            headers: headers,
            timeout: 15000
          });
          
          console.log('=== 消息列表 ===');
          console.log('消息响应:', JSON.stringify(messagesResp.data, null, 2));
        } catch (e) {
          console.error('获取消息失败:', e.message);
        }
      }, 5000);
    }
    
  } catch (e) {
    console.error('=== API 调用失败 ===');
    console.error('错误类型:', e.constructor.name);
    console.error('错误消息:', e.message);
    if (e.response) {
      console.error('HTTP状态:', e.response.status);
      console.error('响应数据:', JSON.stringify(e.response.data, null, 2));
    }
  }
}

testCozeAPI();
