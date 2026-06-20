/**
 * MiniMax 系统音色列表
 * 来源: https://platform.minimaxi.com/docs/faq/system-voice-id
 */
export interface SystemVoice {
  voiceId: string;
  name: string;
  language: string;
}

export const SYSTEM_VOICES: SystemVoice[] = [
  // 中文 (普通话)
  { voiceId: 'male-qn-qingse', name: '青涩青年', language: 'zh' },
  { voiceId: 'male-qn-jingying', name: '精英青年', language: 'zh' },
  { voiceId: 'male-qn-badao', name: '霸道青年', language: 'zh' },
  { voiceId: 'male-qn-daxuesheng', name: '青年大学生', language: 'zh' },
  { voiceId: 'female-shaonv', name: '少女', language: 'zh' },
  { voiceId: 'female-yujie', name: '御姐', language: 'zh' },
  { voiceId: 'female-chengshu', name: '成熟女性', language: 'zh' },
  { voiceId: 'female-tianmei', name: '甜美女性', language: 'zh' },
  { voiceId: 'male-qn-qingse-jingpin', name: '青涩青年-beta', language: 'zh' },
  { voiceId: 'male-qn-jingying-jingpin', name: '精英青年-beta', language: 'zh' },
  { voiceId: 'male-qn-badao-jingpin', name: '霸道青年-beta', language: 'zh' },
  { voiceId: 'male-qn-daxuesheng-jingpin', name: '青年大学生-beta', language: 'zh' },
  { voiceId: 'female-shaonv-jingpin', name: '少女-beta', language: 'zh' },
  { voiceId: 'female-yujie-jingpin', name: '御姐-beta', language: 'zh' },
  { voiceId: 'female-chengshu-jingpin', name: '成熟女性-beta', language: 'zh' },
  { voiceId: 'female-tianmei-jingpin', name: '甜美女性-beta', language: 'zh' },
  { voiceId: 'clever_boy', name: '聪明男童', language: 'zh' },
  { voiceId: 'cute_boy', name: '可爱男童', language: 'zh' },
  { voiceId: 'lovely_girl', name: '萌萌女童', language: 'zh' },
  { voiceId: 'cartoon_pig', name: '卡通猪小琪', language: 'zh' },
  { voiceId: 'bingjiao_didi', name: '病娇弟弟', language: 'zh' },
  { voiceId: 'junlang_nanyou', name: '俊朗男友', language: 'zh' },
  { voiceId: 'chunzhen_xuedi', name: '纯真学弟', language: 'zh' },
  { voiceId: 'lengdan_xiongzhang', name: '冷淡学长', language: 'zh' },
  { voiceId: 'badao_shaoye', name: '霸道少爷', language: 'zh' },
  { voiceId: 'tianxin_xiaoling', name: '甜心小玲', language: 'zh' },
  { voiceId: 'qiaopi_mengmei', name: '俏皮萌妹', language: 'zh' },
  { voiceId: 'wumei_yujie', name: '妩媚御姐', language: 'zh' },
  { voiceId: 'diadia_xuemei', name: '嗲嗲学妹', language: 'zh' },
  { voiceId: 'danya_xuejie', name: '淡雅学姐', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Reliable_Executive', name: '沉稳高管', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_News_Anchor', name: '新闻女声', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Mature_Woman', name: '傲娇御姐', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Unrestrained_Young_Man', name: '不羁青年', language: 'zh' },
  { voiceId: 'Arrogant_Miss', name: '嚣张小姐', language: 'zh' },
  { voiceId: 'Robot_Armor', name: '机械战甲', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Kind-hearted_Antie', name: '热心大婶', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_HK_Flight_Attendant', name: '港普空姐', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Humorous_Elder', name: '搞笑大爷', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Gentleman', name: '温润男声', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Warm_Bestie', name: '温暖闺蜜', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Male_Announcer', name: '播报男声', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Sweet_Lady', name: '甜美女声', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Southern_Young_Man', name: '南方小哥', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Wise_Women', name: '阅历姐姐', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Gentle_Youth', name: '温润青年', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Warm_Girl', name: '温暖少女', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Kind-hearted_Elder', name: '花甲奶奶', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Cute_Spirit', name: '憨憨萌兽', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Radio_Host', name: '电台男主播', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Lyrical_Voice', name: '抒情男声', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Straightforward_Boy', name: '率真弟弟', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Sincere_Adult', name: '真诚青年', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Gentle_Senior', name: '温柔学姐', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Stubborn_Friend', name: '嘴硬竹马', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Crisp_Girl', name: '清脆少女', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Pure-hearted_Boy', name: '清澈邻家弟弟', language: 'zh' },
  { voiceId: 'Chinese (Mandarin)_Soft_Girl', name: '柔和少女', language: 'zh' },
  // 粤语
  { voiceId: 'Cantonese_ProfessionalHost（F)', name: '专业女主持(粤)', language: 'yue' },
  { voiceId: 'Cantonese_GentleLady', name: '温柔女声(粤)', language: 'yue' },
  { voiceId: 'Cantonese_ProfessionalHost（M)', name: '专业男主持(粤)', language: 'yue' },
  { voiceId: 'Cantonese_PlayfulMan', name: '活泼男声(粤)', language: 'yue' },
  { voiceId: 'Cantonese_CuteGirl', name: '可爱女孩(粤)', language: 'yue' },
  { voiceId: 'Cantonese_KindWoman', name: '善良女声(粤)', language: 'yue' },
  // 英语
  { voiceId: 'Santa_Claus', name: 'Santa Claus(英)', language: 'en' },
  { voiceId: 'Charming_Lady', name: 'Charming Lady(英)', language: 'en' },
  { voiceId: 'Sweet_Girl', name: 'Sweet Girl(英)', language: 'en' },
  { voiceId: 'English_Trustworthy_Man', name: 'Trustworthy Man(英)', language: 'en' },
  { voiceId: 'English_Graceful_Lady', name: 'Graceful Lady(英)', language: 'en' },
  { voiceId: 'English_Gentle-voiced_man', name: 'Gentle-voiced Man(英)', language: 'en' },
  // 日语
  { voiceId: 'Japanese_IntellectualSenior', name: 'Intellectual Senior(日)', language: 'ja' },
  { voiceId: 'Japanese_DecisivePrincess', name: 'Decisive Princess(日)', language: 'ja' },
  { voiceId: 'Japanese_LoyalKnight', name: 'Loyal Knight(日)', language: 'ja' },
  { voiceId: 'Japanese_GentleButler', name: 'Gentle Butler(日)', language: 'ja' },
  // 韩语
  { voiceId: 'Korean_SweetGirl', name: 'Sweet Girl(韩)', language: 'ko' },
  { voiceId: 'Korean_CheerfulBoyfriend', name: 'Cheerful Boyfriend(韩)', language: 'ko' },
  { voiceId: 'Korean_ElegantPrincess', name: 'Elegant Princess(韩)', language: 'ko' },
];

export const VOICES_BY_LANGUAGE: Record<string, SystemVoice[]> = SYSTEM_VOICES.reduce((acc, v) => {
  if (!acc[v.language]) acc[v.language] = [];
  acc[v.language].push(v);
  return acc;
}, {} as Record<string, SystemVoice[]>);

export const LANGUAGE_LABELS: Record<string, string> = {
  zh: '中文',
  yue: '粤语',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  pt: 'Português',
};
