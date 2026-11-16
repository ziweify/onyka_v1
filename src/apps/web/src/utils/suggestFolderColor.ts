import type { AccentColor } from '@/stores/theme'

/**
 * Local (offline) semantic color suggestion from a folder name.
 * Keyword match first; otherwise a stable hash so unnamed styles stay consistent.
 */
const RULES: { color: AccentColor; words: string[] }[] = [
  { color: 'red', words: ['紧急', '重要', 'urgent', 'important', 'critical', 'bug', 'error', '报警', '告警', '风险', '逆向', 'hack', 'hook'] },
  { color: 'orange', words: ['待办', 'todo', 'task', '任务', 'inbox', '收件', '跟进', 'follow', '计划', 'plan', '调试', 'debug'] },
  { color: 'amber', words: ['财务', 'finance', 'money', '钱', '账单', 'bill', '预算', 'budget', '发票', 'invoice', '操盘', '交易', 'trade'] },
  { color: 'green', words: ['健康', 'health', '运动', 'sport', '健身', 'fitness', '生活', 'life', 'habit', '习惯'] },
  { color: 'lime', words: ['自然', 'nature', '植物', 'garden', '环保', 'eco', '户外', 'outdoor'] },
  { color: 'teal', words: ['学习', 'study', '教育', 'edu', '课程', 'course', '读书', 'reading', '知识', 'knowledge', '运维', 'ops', '服务'] },
  { color: 'sky', words: ['旅行', 'travel', 'trip', '出行', 'flight', '旅游', 'vacation', '假期', '网络', 'network'] },
  { color: 'cyan', words: ['开发', 'dev', 'code', '代码', '编程', 'api', 'backend', 'frontend', '工程', 'eng', '主机', '虚拟机', 'vm', 'ai'] },
  { color: 'blue', words: ['工作', 'work', 'job', '职场', 'office', '项目', 'project', '业务', 'biz', '客户', 'client', '方案'] },
  { color: 'indigo', words: ['会议', 'meeting', '同步', 'sync', '团队', 'team', '协作', 'collab', '微信', 'wechat'] },
  { color: 'violet', words: ['灵感', 'idea', 'ideas', '创意', 'creative', '设计', 'design', 'ui', 'ux', '艺术', 'art'] },
  { color: 'fuchsia', words: ['个人', 'personal', 'private', '私密', '日记', 'diary', 'journal', '帮助', 'help', 'faq'] },
  { color: 'pink', words: ['家庭', 'family', '孩子', 'kids', '照片', 'photo', '图片', 'image', '相册', 'album'] },
  { color: 'slate', words: ['文档', 'docs', 'doc', '资料', 'archive', '归档', '备份', 'backup', '参考', 'ref'] },
  { color: 'zinc', words: ['临时', 'temp', 'tmp', '草稿', 'draft', '杂项', 'misc', '其他', 'other', '旧', 'old'] },
]

const HASH_COLORS: AccentColor[] = [
  'blue',
  'indigo',
  'violet',
  'teal',
  'cyan',
  'sky',
  'amber',
  'green',
  'orange',
  'pink',
]

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[\s\-_/\\|.:：·]+/g, '')
}

function hashColor(name: string): AccentColor {
  let h = 0
  const s = name.trim() || 'folder'
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return HASH_COLORS[h % HASH_COLORS.length]
}

export function suggestFolderColor(name: string): AccentColor {
  const raw = name.trim().toLowerCase()
  const compact = normalize(name)
  if (!compact) return hashColor(name)

  for (const rule of RULES) {
    for (const word of rule.words) {
      const w = word.toLowerCase()
      const wc = normalize(word)
      if (raw.includes(w) || compact.includes(wc)) {
        return rule.color
      }
    }
  }

  return hashColor(name)
}
