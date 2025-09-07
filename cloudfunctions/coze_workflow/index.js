const cloud = require('wx-server-sdk');
const axios = require('axios');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 检查是否为无关提问的回答
function isIrrelevantResponse(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // 无关提问的关键词和模式
  const irrelevantPatterns = [
    /抱歉.*无法.*提供.*回答/i,
    /我们无法为您提供.*的回答/i,
    /不在.*服务范围/i,
    /专注于.*科研.*合作/i,
    /请问.*科研.*需求/i,
    /我是.*科研.*助手/i,
    /只能.*科研.*相关/i,
    /预约.*进校/i,
    /生活.*服务/i,
    /行政.*事务/i,
    /校园.*导航/i,
    /课程.*安排/i,
    /考试.*成绩/i,
    /宿舍.*食堂/i
  ];
  
  return irrelevantPatterns.some(pattern => pattern.test(text));
}

// 检查是否为详细询问某个特定教授
function isSpecificProfessorInquiry(userInput) {
  if (!userInput || typeof userInput !== 'string') {
    return false;
  }
  
  const specificPatterns = [
    /.*教授.*怎么样/i,
    /.*教授.*详细.*信息/i,
    /.*教授.*研究.*方向/i,
    /.*教授.*联系.*方式/i,
    /.*教授.*发表.*论文/i,
    /.*教授.*具体.*做什么/i,
    /详细.*介绍.*教授/i,
    /能否.*详细.*说明/i,
    /具体.*了解.*教授/i,
    /更多.*关于.*教授/i
  ];
  
  return specificPatterns.some(pattern => pattern.test(userInput));
}

// 从文本中解析教授信息并生成卡片数据
function parseProfesorInfoFromText(text) {
  try {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // 🔥 首先检查是否为无关提问的回答 - 如果是，直接返回null
    if (isIrrelevantResponse(text)) {
      console.log('⚠️ 检测到无关提问回答，跳过教授信息解析');
      return null;
    }

    // 必须包含教授推荐的明确特征才进行解析
    const hasValidProfessorIndicators = [
      /教授.*推荐/i,
      /推荐.*教授/i,
      /以下.*教授/i,
      /为您推荐/i,
      /适合.*教授/i,
      /匹配.*教授/i,
      /科研.*合作.*教授/i,
      /\d+\.\s*\*\*[^*]+\*\*.*?(学院|研究所|系)/i  // 编号+教授姓名+学院格式
    ].some(pattern => pattern.test(text));

    if (!hasValidProfessorIndicators) {
      console.log('⚠️ 文本中未检测到教授推荐特征，跳过解析');
      return null;
    }

    // 寻找教授推荐的文本模式
    const professors = [];
    
    // 更严格的教授匹配：必须同时包含姓名格式和学院信息
    let professorMatches = text.match(/(\d+\.\s*\*\*([^*]+)\*\*[^]*?)(?=\d+\.\s*\*\*|$)/g);
    
    // 如果没有找到编号格式，尝试匹配包含学院信息的教授介绍
    if (!professorMatches || professorMatches.length === 0) {
      // 只有当文本同时包含**姓名**和学院信息时才认为是教授介绍
      const singleProfRegex = /\*\*([^*]+)\*\*[^]*?(学院|研究所|系)/i;
      const singleProfMatch = text.match(singleProfRegex);
      if (singleProfMatch) {
        professorMatches = [singleProfMatch[0]]; // 只使用匹配到的部分，不是整段文本
      }
    }
    
    if (professorMatches && professorMatches.length > 0) {
      professorMatches.forEach((match, index) => {
        try {
          // 提取教授姓名
          const nameMatch = match.match(/\*\*([^*]+)\*\*/);
          const name = nameMatch ? nameMatch[1].trim() : `教授${index + 1}`;
          
          // 提取学院信息 - 只保留学院名称
          let school = '';
          const schoolPatterns = [
            // 匹配：浙江大学xxx学院
            /浙江大学([^，。：:]*?)(学院|研究所|系)/,
            // 匹配：就职于xxx学院（排除教师姓名部分）
            /就职于[^，。：:]*?([^，。：:]*?)(学院|研究所|系)/,
            // 匹配：xxx学院（通用模式，但要避免匹配到教师姓名）
            /(?:^|[，。：:\s])([^，。：:*]*?)(学院|研究所|系)/,
            // 直接匹配常见学院名称
            /(软件学院|计算机学院|信息学院|工程师学院|医学院|管理学院|计算机科学与技术学院|控制科学与工程学院|生物医学工程与仪器科学学院|光电科学与工程学院|材料科学与工程学院|化学工程与生物工程学院|海洋学院|建筑工程学院|机械工程学院|能源工程学院|航空航天学院|电气工程学院|生命科学学院|药学院|基础医学院|公共卫生学院|口腔医学院|护理学院|心理与行为科学系|教育学院|人文学院|外国语言文化与国际交流学院|传媒与国际文化学院|经济学院|管理学院|公共管理学院|法学院|马克思主义学院|数学科学学院|物理学院|化学系|地球科学学院|心理与行为科学系|体育科学与技术学院)/
          ];
          
          for (const pattern of schoolPatterns) {
            const schoolMatch = match.match(pattern);
            if (schoolMatch) {
              if (pattern.source.includes('浙江大学')) {
                // 从浙江大学xx学院中提取学院名
                school = (schoolMatch[1] + schoolMatch[2]).trim();
              } else if (pattern.source.includes('就职于')) {
                // 从"就职于xxx学院"中提取学院名
                school = (schoolMatch[1] + schoolMatch[2]).trim();
              } else if (schoolMatch[2] && (schoolMatch[2] === '学院' || schoolMatch[2] === '研究所' || schoolMatch[2] === '系')) {
                // 通用模式：匹配学院名
                let schoolName = (schoolMatch[1] + schoolMatch[2]).trim();
                // 过滤掉可能的教师姓名（包含**或过短的文本）
                if (!schoolName.includes('*') && schoolName.length > 2) {
                  school = schoolName;
                }
              } else {
                // 直接使用完整匹配（常见学院名称）
                school = schoolMatch[0].trim();
              }
              
              // 如果成功匹配到学院名，跳出循环
              if (school && school.length > 2) {
                break;
              }
            }
          }
          
          // 清理学院名称，移除不必要的前缀和格式
          if (school) {
            // 移除可能的教师姓名和格式标记
            school = school.replace(/\*\*[^*]*\*\*[：:]*/, '').trim(); // 移除 **姓名**：
            school = school.replace(/^[^：:]*[：:]/, '').trim(); // 移除 xxx：
            school = school.replace(/^(浙江大学|浙大)/, '').trim(); // 移除大学名
            school = school.replace(/^就职于/, '').trim(); // 移除"就职于"
            school = school.replace(/^的/, '').trim(); // 移除"的"
            
            // 确保包含学院/研究所/系后缀
            if (school && !school.includes('学院') && !school.includes('研究所') && !school.includes('系')) {
              school = school + '学院';
            }
            
            // 最终检查：如果学院名过短或包含特殊字符，设为默认值
            if (!school || school.length < 3 || school.includes('*') || school.includes('：') || school.includes(':')) {
              school = '未知学院';
            }
          }
          if (!school) school = '未知学院';
          
          // 提取邮箱 - 支持多种格式
          let email = '';
          const emailPatterns = [
            /邮箱[：:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
            /email[：:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g // 直接匹配邮箱格式
          ];
          
          for (const pattern of emailPatterns) {
            const emailMatch = match.match(pattern);
            if (emailMatch && emailMatch[1]) {
              email = emailMatch[1].trim();
              break;
            }
          }

          // 提取办公地点 - 支持多种格式
          let office = '';
          const officePatterns = [
            /(?:办公地点|办公室|地址)[：:\s]*([^\n。；,，]+)/i,
            /(?:办公|地点)[：:\s]*([^\n。；,，]+)/i,
            /(?:位置|地址)[：:\s]*([^\n。；,，]+)/i
          ];
          
          for (const pattern of officePatterns) {
            const officeMatch = match.match(pattern);
            if (officeMatch && officeMatch[1] && officeMatch[1].length > 2) {
              office = officeMatch[1].trim();
              // 移除可能的多余信息
              office = office.replace(/[。；,，].*$/, '').trim();
              if (office.length > 2) {
                break;
              }
            }
          }

          // 提取联系电话 - 支持多种格式
          let phone = '';
          const phonePatterns = [
            /(?:联系)?(?:电话|手机|tel)[：:\s]*([\d\s\-\+\(\)]{8,20})/i,
            /(?:phone|tel)[：:\s]*([\d\s\-\+\(\)]{8,20})/i,
            /(1[3-9]\d{9})/g, // 手机号
            /(\d{3,4}[-\s]?\d{7,8})/g // 固定电话
          ];
          
          for (const pattern of phonePatterns) {
            const phoneMatch = match.match(pattern);
            if (phoneMatch && phoneMatch[1]) {
              phone = phoneMatch[1].trim();
              // 清理格式
              phone = phone.replace(/[^\d\-\+\(\)\s]/g, '').trim();
              if (phone.length >= 8) {
                break;
              }
            }
          }
          
          // 提取主页链接 - 支持多种格式
          const homepages = [];
          const homepagePatterns = [
            /(?:个人主页|主页|网站|homepage|website)[：:\s]*(https?:\/\/[^\s，。）\n,]+)/gi,
            /(?:主页|homepage)[：:\s]*(https?:\/\/[^\s，。）\n,]+)/gi,
            /(https?:\/\/[^\s，。）\n,]+)/g // 直接匹配URL
          ];
          
          for (const pattern of homepagePatterns) {
            let homepageMatch;
            while ((homepageMatch = pattern.exec(match)) !== null) {
              const url = homepageMatch[1].trim();
              if (url && !homepages.includes(url)) {
                homepages.push(url);
              }
            }
          }
          
          // 🔍 如果基本提取失败，尝试更宽松的提取
          if (!email) {
            const looseEmailMatch = match.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (looseEmailMatch) {
              email = looseEmailMatch[1].trim();
              console.log(`🔍 宽松匹配找到邮箱: ${email}`);
            }
          }
          
          if (!phone) {
            const loosePhoneMatch = match.match(/(1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8})/);
            if (loosePhoneMatch) {
              phone = loosePhoneMatch[1].trim();
              console.log(`🔍 宽松匹配找到电话: ${phone}`);
            }
          }
          
          if (homepages.length === 0) {
            const looseUrlMatches = match.match(/(https?:\/\/[^\s，。）\n,]+)/g);
            if (looseUrlMatches) {
              looseUrlMatches.forEach(url => {
                if (!homepages.includes(url)) {
                  homepages.push(url);
                }
              });
              console.log(`🔍 宽松匹配找到主页: ${homepages}`);
            }
          }
          
          // 🔍 调试日志：显示提取到的联系信息
          console.log(`教授 ${name} 联系信息提取结果:`, {
            email: email || '未找到',
            office: office || '未找到', 
            phone: phone || '未找到',
            homepages: homepages.length > 0 ? homepages : ['未找到']
          });
          
          // 提取标签/研究方向 - 只保留核心关键词
          const tags = [];
          const coreKeywords = [
            '计算机视觉', '机器视觉', 
            '人工智能', '机器学习', '深度学习', 
            '自然语言处理', 'NLP', '语言模型',
            '大模型', 'LLM', 
            '多模态', 
            '数据挖掘',
            '智能控制', '自动化', 
            '软件工程', '系统设计',
            '网络安全', '信息安全',
            '数据库', '云计算',
            '物联网', 'IoT',
            '区块链',
            '高分子流变学','多组分聚合物材料结构与性能',
            '高分子复合材料','文物数字化',
            '碳氢键精准催化转化','不对称合成',
            '天然产物及药物合成','机器学习',
            '大数据解析','工业大数据',
            '工业人工智能','智能制造','智慧能源',
            '智慧医疗','光通信 / 光互联', '光计算的硅基光子集成前沿及应用研究',
            'Multimode silicon photonics',
            'Silicon - plus photonics','Reconfigurable silicon photonics',
            'Silicon photonics for polarization - handling and wavelength - filtering',
            '计算机图形学','人机交互','虚拟现实',
            '信息与电子工程','天然产物全合成及导向天然产物的新反应方法学',
            '多媒体分析与检索','跨媒体计算',
            'T 细胞生物学','细胞信号传导','细胞免疫学',
            '免疫调节','自身免疫病','肿瘤免疫','网络优化与控制',
            '网络系统安全','工业大数据与物联网',
            '检测技术与自动化装置','电磁波理论及应用','新型人工电磁介质',
            '电磁波隐身','深度学习与智能电磁调控','光学检测','激光雷达',
            '生物制药技术','生物催化和转化','蛋白质工程','界面电化学',
            '电化学发光和谱学电化学联用',
            '高灵敏和快速免疫检测方法、技术、便携式装置以及生医工交叉',
            '脑神经电化学','化学脑机接口',
            '基于可穿戴传感器的健康连续监测和运动饮食辅助治疗','锂电池',
            '电化学催化转化','其他新型电池','医学人工智能','模式识别',
            '数据挖掘','超分辨光学成像','超分辨光刻',
            '计算机体系结构及微结构','集成电路设计','硬件安全',
            '电机与驱动控制','新能源技术','视觉媒体智能编码',
            '视频与点云智能应用','视觉感知与体验质量评价',
            '教育领导与政策研究','高等教育政策与治理','学术职业',
            '系统医学与合成生物学','生物医学信息学','肿瘤免疫治疗',
            '合成生物信息学','具有病理生理意义的标志物的发现',
            '合成生物系统的多组学时间序列建模','基于自然语言的知识表示和知识推理',
            '生物大分子 RNA 化学修饰及其生物学意义',
            'RNA 化学标记及 RNA 碱基化学修饰测序方法开发',
            '荧光生物探针和生物成像'

            
          ];
          
          coreKeywords.forEach(keyword => {
            if (match.toLowerCase().includes(keyword.toLowerCase())) {
              if (!tags.includes(keyword)) {
                tags.push(keyword);
              }
            }
          });
          
          // 限制标签数量
          const finalTags = tags.slice(0, 4);
          
          // 简化内容提取 - 只保留真正的研究成果
          let researchContent = match;
          
          // 移除所有联系信息（简单粗暴但有效）
          researchContent = researchContent.replace(/\*\*[^*]+\*\*/g, ''); // 移除姓名
          researchContent = researchContent.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ''); // 移除邮箱
          researchContent = researchContent.replace(/https?:\/\/[^\s，。）\n,]+/g, ''); // 移除URL
          researchContent = researchContent.replace(/[\d]{3,4}[\s\-]?[\d]{8,11}/g, ''); // 移除电话
          researchContent = researchContent.replace(/(邮箱|电话|主页|网站|办公地点|地址|联系方式)[：:]?[^。\n]*[。\n]?/g, ''); // 移除含关键词的句子
          
          // 简单分割成句子
          const achievements = researchContent
            .split(/[。；;\n]/)
            .map(s => s.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim())
            .filter(s => s.length > 10 && !/(邮箱|电话|主页|网站|办公地点|地址|联系方式|http|@)/.test(s))
            .slice(0, 5);
          
          const finalHighlights = achievements.length > 0 ? achievements : [
            '在相关研究领域具有丰富经验',
            '承担多项重要科研项目'
          ];
          
          // 计算匹配度
          let score = 60; // 基础分
          if (email) score += 10;
          if (homepages.length > 0) score += 10;
          if (finalTags.length > 0) score += 10;
          if (achievements.length > 2) score += 5;
          if (office) score += 2;
          if (phone) score += 3;
          
          const professorData = {
            name: name,
            school: school, // 学院（只包含学院名称）
            areas: finalTags, // 标签（只包含研究方向关键词）
            highlights: finalHighlights, // 研究成果等无序列表（绝对不包含联系方式）
            score: Math.min(score, 100),
            displayScore: Math.min(score, 100),
            profId: `prof_${Date.now()}_${index}`,
            documentId: `doc_${Date.now()}_${index}`
          };
          
          // 只有在有值的情况下才添加
          if (email) {
            professorData.email = email;
          }
          if (office) {
            professorData.office = office;
          }
          if (phone) {
            professorData.phone = phone;
          }
          if (homepages.length > 0) {
            professorData.homepages = homepages;
          }
          
          professors.push(professorData);
          
        } catch (e) {
          console.log(`解析第${index + 1}位教授信息失败:`, e);
        }
      });
    }
    
    if (professors.length > 0) {
      console.log(`成功解析 ${professors.length} 位教授信息`);
      return {
        type: "professor_list",
        professors: professors
      };
    }
    
  } catch (e) {
    console.log('解析教授信息失败:', e);
  }
  
  return null;
}

// 清理回答文本，去掉引用标记和markdown语法
function cleanResponseText(text, cardData) {
  // 如果成功生成了教授卡片数据，则完全隐藏文字回复
  if (cardData && cardData.type === 'professor_list' && cardData.professors && cardData.professors.length > 0) {
    return '';
  }

  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let cleanedText = text;
  
  // 彻底清理所有垃圾标记和引用
  cleanedText = cleanedText.replace(/\[\d+\]\s*prof_info/gi, ''); // [1] prof_info
  cleanedText = cleanedText.replace(/\[\d+\]\s*/g, ''); // [1] 
  cleanedText = cleanedText.replace(/\[\d+\]/g, ''); // [1]
  cleanedText = cleanedText.replace(/【\d+】/g, ''); // 【1】
  cleanedText = cleanedText.replace(/\(\d+\)/g, ''); // (1)
  cleanedText = cleanedText.replace(/\*\*(.*?)\*\*/g, '$1'); // **text**
  cleanedText = cleanedText.replace(/\*(.*?)\*/g, '$1'); // *text*
  
  return cleanedText.trim();
}

exports.main = async (event) => {
  // 兼容 Node.js 10.15 的参数解构方式
  const eventData = event || {};
  const input = eventData.input || '';
  const bot_id = eventData.bot_id || '7537877620181041204'; // 你的智能体ID
  const conversation_id = eventData.conversation_id || ''; // 对话ID
  const user_id = eventData.user_id || 'miniprogram_user'; // 用户ID

  if (!input) {
    return { code: 400, message: 'input required' };
  }

  // 从环境变量获取token（生产环境安全方式）
  const COZE_TOKEN = process.env.COZE_TOKEN;
  console.log('环境变量检查:', {
    hasToken: !!COZE_TOKEN,
    tokenLength: COZE_TOKEN ? COZE_TOKEN.length : 0,
    tokenPrefix: COZE_TOKEN ? COZE_TOKEN.substring(0, 10) + '...' : 'null'
  });
  
  if (!COZE_TOKEN) {
    console.error('COZE_TOKEN 环境变量未配置');
    return { code: 500, message: 'COZE_TOKEN environment variable not configured' };
  }

  // 使用新的Chat API v3
  const url = 'https://api.coze.cn/v3/chat';
  const headers = {
    Authorization: `Bearer ${COZE_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json', // 非流式
  };

  // 构建聊天请求体（按照官方文档格式）
  const body = {
    bot_id: bot_id,
    user_id: user_id,
    stream: false, // 非流式
    auto_save_history: true, // 自动保存对话历史
  };

  // 如果有对话ID，使用conversation_id进行多轮对话
  if (conversation_id) {
    body.conversation_id = conversation_id;
    // 多轮对话模式：只发送当前用户消息
    body.additional_messages = [
      {
        content: input,
        content_type: "text",
        role: "user",
        type: "question"
      }
    ];
  } else {
    // 首轮对话模式：使用messages字段
    body.messages = [
      {
        content: input,
        content_type: "text", 
        role: "user",
        type: "question"
      }
    ];
  }

  try {
    console.log('=== 开始调用扣子智能体API ===');
    console.log('请求参数:', { bot_id, user_id, conversation_id, input: input.substring(0, 50) + '...' });
    console.log('请求URL:', url);
    console.log('请求体:', JSON.stringify(body, null, 2));
    
    const resp = await axios.post(url, body, { 
      headers: headers, 
      timeout: 30000,
      validateStatus: function (status) {
        return status < 500; // 接受所有小于500的状态码
      }
    });
    
    console.log('=== API调用成功 ===');
    console.log('HTTP状态:', resp.status);
    console.log('响应数据:', JSON.stringify(resp.data, null, 2));
    
    const result = resp.data;
    
    if (resp.status !== 200) {
      throw new Error(`API调用失败: ${resp.status} - ${result?.error?.message || '未知错误'}`);
    }

    // 获取chat_id和conversation_id
    const chat_id = result.data?.id;
    const conversation_id_new = result.data?.conversation_id || conversation_id;
    
    if (!chat_id) {
      throw new Error('未获取到chat_id');
    }

    // 如果状态是in_progress，需要轮询获取最终结果
    let chatStatus = result.data?.status;
    let finalResult = result;
    let retryCount = 0;
    const maxRetries = 20; // 增加到20次
    
    while (chatStatus === 'in_progress' && retryCount < maxRetries) {
      console.log(`=== 轮询获取结果 (第${retryCount + 1}次) ===`);
      
      // 动态调整等待时间：前几次短一些，后面长一些
      const retryInterval = retryCount < 5 ? 2000 : (retryCount < 10 ? 3000 : 4000);
      console.log(`等待 ${retryInterval}ms 后查询...`);
      
      // 等待一段时间再查询
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      
      // 查询聊天结果
      const queryResp = await axios.get(`https://api.coze.cn/v3/chat/retrieve?chat_id=${chat_id}&conversation_id=${conversation_id_new}`, {
        headers: headers,
        timeout: 15000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log(`轮询响应 (${retryCount + 1}):`, JSON.stringify(queryResp.data, null, 2));
      
      if (queryResp.status === 200 && queryResp.data?.data) {
        finalResult = queryResp.data;
        chatStatus = queryResp.data.data.status;
        
        if (chatStatus === 'completed') {
          console.log('✅ 智能体处理完成');
          break;
        } else if (chatStatus === 'failed') {
          console.error('❌ 智能体处理失败，详细信息:', JSON.stringify(queryResp.data, null, 2));
          
          // 检查是否是余额不足的错误
          const errorCode = queryResp.data?.data?.last_error?.code;
          const errorMsg = queryResp.data?.data?.last_error?.msg;
          
          if (errorCode === 4028) {
            console.log('💰 检测到余额不足错误，将返回特殊提示');
          }
          
          // 不要立即抛出错误，继续尝试获取消息
          break;
        }
      }
      
      retryCount++;
    }

    if (chatStatus === 'in_progress') {
      console.warn('⚠️ 轮询超时，尝试获取当前消息');
      // 即使轮询超时，也尝试获取可能已经生成的消息
    } else if (chatStatus === 'failed') {
      console.warn('⚠️ 智能体处理失败，但仍尝试获取可能的消息');
    }

    // 获取聊天消息 - 无论是否完成都尝试获取
    let messagesResp;
    try {
      messagesResp = await axios.get(`https://api.coze.cn/v3/chat/message/list?chat_id=${chat_id}&conversation_id=${conversation_id_new}`, {
        headers: headers,
        timeout: 15000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      console.log('消息列表响应:', JSON.stringify(messagesResp.data, null, 2));
    } catch (e) {
      console.error('获取消息列表失败:', e.message);
      // 如果获取消息失败，使用默认消息
      messagesResp = { status: 500, data: null };
    }

    // 解析真实的AI回复
    let response_text = '';
    let card_data = null;
    
    // 处理返回的消息
    if (messagesResp.status === 200 && messagesResp.data?.data?.length > 0) {
      const messages = messagesResp.data.data;
      console.log(`找到 ${messages.length} 条消息`);
      
      // 查找助手回复（包括部分完成的回复）
      let assistantMessages = [];
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        console.log(`消息 ${i + 1}:`, { role: msg.role, type: msg.type, content_length: msg.content ? msg.content.length : 0 });
        if (msg.role === 'assistant' && (msg.type === 'answer' || msg.type === 'function_call' || msg.type === 'tool_response')) {
          assistantMessages.push(msg);
          console.log(`助手消息 ${i + 1}:`, { type: msg.type, content_preview: msg.content ? msg.content.substring(0, 100) + '...' : 'no content' });
        }
      }
      
      // 拼接所有助手消息
      if (assistantMessages.length > 0) {
        // 优先使用最后一条answer类型的消息
        const answerMsg = assistantMessages.reverse().find(msg => msg.type === 'answer' && msg.content);
        if (answerMsg) {
          response_text = answerMsg.content;
          console.log('✅ 使用answer类型消息:', response_text.substring(0, 100) + '...');
        } else {
          // 如果没有answer，使用所有有内容的消息
          response_text = assistantMessages
            .filter(msg => msg.content)
            .map(msg => msg.content)
            .join('\n\n');
          console.log('✅ 使用合并消息:', response_text.substring(0, 100) + '...');
        }
        
        // 只有在有实际内容时才进行解析和清理
        if (response_text && response_text.trim().length > 0) {
          // 首先检查是否为无关提问的回答
          if (isIrrelevantResponse(response_text)) {
            console.log('✅ 检测到无关提问，返回标准回复');
            response_text = '抱歉，我们无法为您提供相关内容的回答，请问您有什么科研合作需求？';
            card_data = null; // 不生成教授卡片
          } else {
            // 🔥 更严格的教授信息解析：只有明确的教授推荐才生成卡片
            console.log('✅ 尝试解析教授信息，响应文本长度:', response_text.length);
            card_data = parseProfesorInfoFromText(response_text);
            
            if (card_data && card_data.professors && card_data.professors.length > 0) {
              console.log('✅ 成功解析到教授信息，生成卡片数据');
              // 清理回答文本，去掉引用标记和markdown语法
              response_text = cleanResponseText(response_text, card_data);
            } else {
              console.log('ℹ️ 未检测到有效教授信息，保持文本回复');
              card_data = null;
              // 简单清理文本但保留内容
              response_text = response_text.replace(/\[\d+\]/g, '').replace(/【\d+】/g, '').trim();
            }
          }
        }
      } else {
        console.log('❌ 没有找到助手消息');
      }
    } else {
      console.log('❌ 获取消息失败或消息为空');
    }
    
    // 如果没找到有效回复，根据状态生成提示消息
    if (!response_text || response_text.trim().length === 0) {
      console.log('❌ 没有获取到有效回复，生成fallback消息');
      if (chatStatus === 'in_progress') {
        response_text = '智能体正在为您分析，处理时间较长，请稍后重试或换个问题试试。';
      } else if (chatStatus === 'failed') {
        response_text = '智能体处理遇到问题，请稍后重试或换个表达方式。';
        // 对于失败的情况，提供简单的建议而不是假的教授卡片
        console.log('智能体处理失败，提供重试建议');
      } else {
        response_text = '抱歉，暂时无法为您提供回复，请稍后重试。';
      }
    } else {
      console.log('✅ 获取到有效回复，长度:', response_text.length);
    }
    
    console.log('=== 处理完成 ===');
    console.log('最终回复文本:', response_text);
    console.log('卡片数据:', card_data);
    console.log('用户输入:', input);
    
    // 判断用户问题类型
    const isSpecificInquiry = isSpecificProfessorInquiry(input);
    console.log('是否为详细询问:', isSpecificInquiry);
    
    // 🚨🚨🚨 最关键的强制检查：根据问题类型决定返回策略 🚨🚨🚨
    if (card_data && card_data.type === 'professor_list' && card_data.professors && card_data.professors.length > 0) {
      // 再次检查是否为无关提问，如果是则清空卡片数据
      if (isIrrelevantResponse(response_text)) {
        console.log('✅ 无关提问检测，清空卡片数据，保留文字回复');
        card_data = null;
      } else if (isSpecificInquiry) {
        // 详细询问：保留文字回复和卡片数据
        console.log('✅ 详细询问检测，保留文字回复和卡片数据');
      } else {
        // 宽泛问题：只返回卡片，清空文字回复
        response_text = '';
        console.log('✅ 宽泛问题检测，清空文字回复，只保留卡片数据');
      }
    }
    
    return { 
      code: 0, 
      data: { 
        response_text: response_text, 
        card_data: card_data, 
        conversation_id: conversation_id_new,
        raw: finalResult
      } 
    };
  } catch (e) {
    console.error('=== API调用失败 ===');
    console.error('错误类型:', e.constructor.name);
    console.error('错误消息:', e.message);
    if (e.response) {
      console.error('HTTP状态:', e.response.status);
      console.error('响应头:', e.response.headers);
      console.error('响应数据:', e.response.data);
    }
    console.error('完整错误:', e);
    
    return { 
      code: 500, 
      message: 'API调用失败: ' + e.message, 
      error: {
        type: e.constructor.name,
        message: e.message,
        status: e.response && e.response.status,
        data: e.response && e.response.data
      }
    };
  }
};
