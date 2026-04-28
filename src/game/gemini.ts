import { GoogleGenAI, Type } from '@google/genai';
import { OpenAI } from 'openai';
import { GameStats, Choice, Talent, World, GameEvent, NPC, LLMConfig } from './types';

let genAIClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let currentConfig: string = '';

function getClient(config: LLMConfig) {
  const configStr = JSON.stringify(config);
  if (currentConfig !== configStr || (!genAIClient && !openaiClient)) {
    if (config.provider === 'gemini') {
      genAIClient = new GoogleGenAI({ apiKey: config.apiKey || process.env.VITE_GEMINI_API_KEY || '' });
      openaiClient = null;
    } else {
      openaiClient = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
        dangerouslyAllowBrowser: true
      });
      genAIClient = null;
    }
    currentConfig = configStr;
  }
  return { genAIClient, openaiClient };
}

const GENERATE_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string', description: '事件的详细描述，重要节点的剧场可包含生动的场景描写与角色对话（100-300字）。' },
    newNPCs: {
      type: 'array',
      description: '本次事件新引入的角色',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', description: '如：同门师妹、公司竞争对手、街头医生' },
          description: { type: 'string' },
          relation: { type: 'number', description: '初始关系值，一般为0' },
          status: { type: 'string', enum: ['alive', 'dead'] }
        },
        required: ['id', 'name', 'role', 'description', 'relation', 'status']
      }
    },
    choices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          logText: { type: 'string' },
          statChanges: {
            type: 'object',
            properties: {
              health: { type: 'integer' }, int: { type: 'integer' }, cha: { type: 'integer' },
              wealth: { type: 'integer' }, luck: { type: 'integer' }, str: { type: 'integer' }
            }
          },
          npcInteraction: {
            type: 'object',
            properties: {
              npcId: { type: 'string' },
              relationChange: { type: 'integer' },
              logDetail: { type: 'string', description: '互动的具体后果描述' }
            },
            required: ['npcId', 'relationChange', 'logDetail']
          }
        },
        required: ['text', 'logText']
      }
    }
  },
  required: ['text', 'choices']
};

export async function generateDynamicEvent(
  config: LLMConfig,
  world: World,
  age: number,
  gender: string,
  stats: GameStats,
  talents: Talent[],
  flags: Record<string, number>,
  history: string[],
  npcs: NPC[]
): Promise<GameEvent> {
  const aliveNPCs = npcs.filter(n => n.status === 'alive');
  const prompt = `你是一个模拟人生游戏的AI故事导演。
目前玩家生存的世界背景是：${world.name} - ${world.desc}
玩家当前年龄：${age}岁，性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未知'}
玩家当前属性：健康${stats.health}, 智力${stats.int}, 颜值${stats.cha}, 家境${stats.wealth}, 运气${stats.luck}, 体质${stats.str}
玩家当前天赋：${talents.map(t => t.name).join('，') || '无'}
已有角色（关系）：${aliveNPCs.map(n => n.name + '(' + n.role + ', 关系度:' + n.relation + ')').join('; ')} (如果没有则为无)

过去最近发生的事情：
${history.slice(-10).join('\n')}

请为玩家${age}岁生成一个全新且个性化的事件、遭遇或剧情互动。
【导演核心法则】：
1. 剧情节奏与情感曲线：遵循“平缓 - 突变 - 高潮 - 回落”的规律。根据历史判断阶段，调整剧情张力。详略得当，有时可以直接描述平淡或快进的剧情，有的年度则可以是极其详细的小剧场（可以跨越几个回合继续深入）。
2. 呈现形式多样化：不一定非要对话，生动的内心独白、客观的环境白描都可以。
3. 动态关系与生老病死：NPC也有自己的命运。如果他们遭遇了危险或者大限已至，请在返回中明确表示出改变，如果是大变化甚至是死亡，可以在选项导致的后果（npcInteraction）或者新引入角色（newNPCs）中更新他们的状态（例如将状态改为dead）。
4. 年龄差异化：16岁之前为成长铺垫期，可稍微进行剧情加速缩影；成人后重点展开深度的剧情体验。
5. 真实的世界编章：引入新角色或深化已有角色。
6. 提供2到3个不同的抉择选项。

必须返回符合如下结构的JSON：
` + JSON.stringify(GENERATE_SCHEMA, null, 2);

  try {
    const { genAIClient, openaiClient } = getClient(config);
    let jsonStr = '';

    if (config.provider === 'gemini' && genAIClient) {
      const response = await genAIClient.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      jsonStr = response.text || '';
    } else if (openaiClient) {
      const response = await openaiClient.chat.completions.create({
        model: config.model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      jsonStr = response.choices[0].message.content || '';
    }

    // Clean json markdown format if any
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!jsonStr) throw new Error('Empty response');

    const parsed = JSON.parse(jsonStr);
    return {
      id: `ai_event_${Date.now()}`,
      worldIds: [],
      minAge: 0,
      maxAge: 999,
      text: parsed.text || '事件生成失败',
      choices: parsed.choices || [{text: '继续', logText: '...'}],
      newNPCs: parsed.newNPCs
    };
  } catch (error) {
    console.error('AI Generation failed:', error);
    return {
      id: 'fallback',
      worldIds: [], minAge: 0, maxAge: 999,
      text: '这一年过得很平静。',
      choices: [{ text: '顺其自然', logText: '时光荏苒。' }]
    };
  }
}

const CUSTOM_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    logText: { type: 'string', description: '行动产生的直接后果描述' },
    statChanges: {
      type: 'object',
      properties: {
        health: { type: 'integer' }, int: { type: 'integer' }, cha: { type: 'integer' },
        wealth: { type: 'integer' }, luck: { type: 'integer' }, str: { type: 'integer' }
      }
    },
    npcInteraction: {
      type: 'object',
      properties: {
        npcId: { type: 'string' },
        relationChange: { type: 'integer' },
        logDetail: { type: 'string' }
      }
    }
  },
  required: ['logText']
};

const EVALUATION_SCHEMA = {
  type: 'object',
  properties: {
    dramaScore: { type: 'integer', description: '戏剧性评分 (0-100)' },
    achievementScore: { type: 'integer', description: '成就度评分 (0-100)' },
    meaningScore: { type: 'integer', description: '意义感评分 (0-100)' },
    epicCommentary: { type: 'string', description: '具有史诗感的人生总结点评（80-150字）' }
  },
  required: ['dramaScore', 'achievementScore', 'meaningScore', 'epicCommentary']
};

export async function processCustomInput(
  config: LLMConfig,
  input: string,
  world: World,
  age: number,
  gender: string,
  stats: GameStats,
  talents: Talent[],
  flags: Record<string, number>,
  npcs: NPC[],
  currentEvent: GameEvent
): Promise<Choice> {
  const prompt = `玩家在模拟人生游戏中遇到了以下事件：
"${currentEvent.text}"

玩家决定采取以下自定义行动：
"${input}"

请作为故事导演，评估这个行动在当前世界背景（${world.name}）下的后果。
玩家当前状态：${age}岁，性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未知'}，健康${stats.health}, 智力${stats.int}, 颜值${stats.cha}, 家境${stats.wealth}, 运气${stats.luck}, 体质${stats.str}
当前角色：${npcs.map(n => n.name + '(' + n.role + ')').join(', ')}

请根据剧情的情感联结和空间叙事，生成具体且符合逻辑的互动结果。若有角色互动，请体现出牵绊的变化或是生死离别。

必须返回符合如下结构的JSON：
` + JSON.stringify(CUSTOM_INPUT_SCHEMA, null, 2);

  try {
    const { genAIClient, openaiClient } = getClient(config);
    let jsonStr = '';

    if (config.provider === 'gemini' && genAIClient) {
      const response = await genAIClient.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      jsonStr = response.text || '';
    } else if (openaiClient) {
      const response = await openaiClient.chat.completions.create({
        model: config.model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      jsonStr = response.choices[0].message.content || '';
    }

    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    if (!jsonStr) throw new Error('Empty response');

    const parsed = JSON.parse(jsonStr);
    return {
      text: input.slice(0, 15),
      logText: parsed.logText,
      statChanges: parsed.statChanges,
      npcInteraction: parsed.npcInteraction
    };
  } catch (error) {
    return { text: '行动...', logText: '你的行动产生了一些难以言说的后果。' };
  }
}

export async function evaluateLife(
  config: LLMConfig,
  world: World,
  age: number,
  gender: string,
  stats: GameStats,
  history: string[],
  deathReason: string
) {
  const prompt = `玩家在${world.name}（${world.desc}）中结束了短暂而可贵的一生。
玩家结束时的年龄：${age}岁，性别：${gender === 'male' ? '男' : gender === 'female' ? '女' : '未知'}。
最终属性：健康${stats.health}, 智力${stats.int}, 颜值${stats.cha}, 家境${stats.wealth}, 运气${stats.luck}, 体质${stats.str}

主要生平记录：
${history.join('\n')}

死亡原因/结局：${deathReason}

请你作为命运的记录者，对这段人生进行结语，并从戏剧性、成就度和意义感三个维度进行0-100的打分。点评必须要有一种史诗感、沧桑感或宿命感。

必须返回符合如下结构的JSON：
` + JSON.stringify(EVALUATION_SCHEMA, null, 2);

  try {
    const { genAIClient, openaiClient } = getClient(config);
    let jsonStr = '';

    if (config.provider === 'gemini' && genAIClient) {
      const response = await genAIClient.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      jsonStr = response.text || '';
    } else if (openaiClient) {
      const response = await openaiClient.chat.completions.create({
        model: config.model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      jsonStr = response.choices[0].message.content || '';
    }

    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    if (!jsonStr) throw new Error('Empty response');

    const parsed = JSON.parse(jsonStr);
    return {
      dramaScore: parsed.dramaScore || 0,
      achievementScore: parsed.achievementScore || 0,
      meaningScore: parsed.meaningScore || 0,
      epicCommentary: parsed.epicCommentary || '命运的长河静静流淌，又有一颗星辰黯淡陨落。',
    };
  } catch (error) {
    console.error('AI Evaluation failed:', error);
    return {
      dramaScore: 50,
      achievementScore: 50,
      meaningScore: 50,
      epicCommentary: '凡人皆有一死，这大概这就是人生吧。',
    };
  }
}

