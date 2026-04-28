export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Gender = 'male' | 'female' | 'unknown';

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'deepseek';
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface GameStats {
  health: number; // 健康
  int: number;    // 智力
  cha: number;    // 颜值
  wealth: number; // 家境
  luck: number;   // 运气
  str: number;    // 体质
}

export interface LogEntry {
  age: number;
  text: string;
}

export interface Talent {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  effects?: Partial<GameStats>;
  worldIds?: string[]; // Empty means all worlds
  exclusiveTags?: string[]; // Prevent selecting talents with same tags
}

export interface DynamicTalent extends Talent {
  condition: (flags: Record<string, number>, stats: GameStats) => boolean;
}

export interface World {
  id: string;
  name: string;
  desc: string;
  baseStats: GameStats;
}

export interface NPC {
  id: string;
  name: string;
  relation: number; // -100 to 100
  status: 'alive' | 'dead';
  description: string;
  role: string;
}

export interface Choice {
  text: string;
  statChanges?: Partial<GameStats>;
  flagChanges?: Record<string, number>;
  logText: string;
  npcInteraction?: {
    npcId: string;
    relationChange: number;
    logDetail: string;
  };
}

export interface GameEvent {
  id: string;
  worldIds: string[]; // 如果为空数组，则适用于所有世界
  minAge: number;
  maxAge: number;
  text: string;
  choices: Choice[];
  condition?: (flags: Record<string, number>, stats: GameStats) => boolean;
  newNPCs?: NPC[]; // Any NPCs introduced in this event
}
