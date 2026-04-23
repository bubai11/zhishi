const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    name: '知拾植物系统接口文档',
    description: '基于后端 Express 路由、控制器、校验器和现有 API 文档整理。所有请求使用 {{base_url}}，需要登录的接口预设 Authorization: Bearer {{token}}。先调用“用户模块/用户登录”获取 token 后，写入 Postman 环境变量 token。',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    { key: 'base_url', value: 'http://localhost:3001', type: 'string', description: '后端服务基础地址。' },
    { key: 'token', value: '', type: 'string', description: 'JWT 登录令牌，不包含 Bearer 前缀。' }
  ],
  item: []
};

const bodies = {
  register: { username: 'test_user', password: '123456', email: 'test@example.com' },
  login: { username: 'test_user', password: '123456' },
  plant: {
    taxon_id: 5,
    chinese_name: '向日葵',
    scientific_name: 'Helianthus annuus',
    cover_image: 'https://example.com/images/helianthus-annuus.jpg',
    short_desc: '常见观赏与油料植物。',
    intro: '植物介绍。',
    morphology: '形态特征。',
    lifecycle: '生命周期。',
    habitat: '生境信息。',
    distribution: '分布信息。',
    uses: '用途说明。'
  },
  plantPatch: { chinese_name: '向日葵（更新）', short_desc: '更新后的简介。', intro: '更新后的介绍。' },
  taxon: { taxon_rank: 'species', parent_id: 4, scientific_name: 'Helianthus annuus', chinese_name: '向日葵' },
  taxonPatch: { chinese_name: '向日葵（更新）', description: '分类节点说明。' },
  favorite: { plant_id: 1 },
  browse: { plant_id: 1, source: 'detail_page', duration: 35 },
  quiz: {
    title: '植物基础测验',
    scope: 'basic',
    questions: [
      {
        type: 'single',
        stem: '向日葵常见花色是？',
        explanation: '向日葵舌状花通常为黄色。',
        options: [
          { text: '黄色', is_correct: true },
          { text: '蓝色', is_correct: false }
        ]
      }
    ]
  },
  answers: { answers: [{ question_id: 1, chosen_option_id: 2 }, { question_id: 2, chosen_option_id: 6 }] },
  media: {
    kind: 'image',
    storage_provider: 'local',
    object_key: 'plants/helianthus-annuus/cover.jpg',
    url: '/images/plants/helianthus-annuus/cover.jpg',
    width: 1200,
    height: 800,
    metadata: { source: 'manual', license: 'CC BY' }
  },
  mediaPatch: { url: '/images/plants/helianthus-annuus/detail.jpg', width: 1600, height: 1000 },
  bindMedia: { plant_id: 1, sort_order: 0, caption: '植物封面图' },
  translation: { plantId: 1, chineseName: '向日葵', source: 'manual' }
};

const queryNotes = {
  page: '页码，从 1 开始。',
  limit: '每页数量或返回数量。',
  keyword: '搜索关键字，可匹配中文名、学名或名称字段。',
  q: '必填搜索关键字。',
  sort: '排序方式，常用值：relevance、latest、popular、alpha。',
  rank: '分类级别：kingdom、phylum、subphylum、class、order、family、genus、species。',
  parent_id: '父级分类 ID。',
  parentId: '父级分类 ID；为空时返回根级节点。',
  taxonId: '分类 ID 过滤。',
  family: '科科学名过滤。',
  genus: '属科学名过滤。',
  kind: '媒体类型：image、model、video。',
  plant_id: '植物 ID。',
  category: 'IUCN 等级，例如 CR、EN、VU、NT、LC。',
  unreadOnly: '是否只返回未读记录，true/false。',
  includeDismissed: '是否包含已忽略预警，true/false。',
  alertLevel: '预警等级：high、medium、low。',
  changeType: '变化类型：new_assessment、downgraded、upgraded、new_addition。',
  iso3: 'ISO3 国家代码，例如 CHN。',
  siteType: '保护地站点类型。',
  iucnCategory: 'IUCN 保护地类别。',
  status: '保护地状态。',
  realm: '生态地理界。',
  groupBy: '分组方式：family、division、phylum。',
  areaCode: 'WGSRPD Level 3 区域代码。',
  area_code_l3: 'WGSRPD Level 3 区域代码。',
  source: '来源标识。',
  duration: '浏览停留时长，单位按前端约定。'
};

function q(key, value, disabled = false, description = queryNotes[key] || '查询参数。') {
  return { key, value: String(value), disabled, description };
}

function make(spec) {
  const query = spec.query || [];
  const headers = [];
  if (spec.auth) headers.push({ key: 'Authorization', value: 'Bearer {{token}}', description: 'JWT 鉴权令牌。' });
  if (spec.body) headers.push({ key: 'Content-Type', value: 'application/json', description: '请求体为 JSON 格式。' });
  return {
    name: spec.name,
    request: {
      method: spec.method,
      header: headers,
      description: spec.description,
      url: {
        raw: `{{base_url}}${spec.path}${query.length ? '?' + query.map((p) => `${p.key}=${p.value}`).join('&') : ''}`,
        host: ['{{base_url}}'],
        path: spec.path.split('/').filter(Boolean),
        query
      },
      ...(spec.body ? { body: { mode: 'raw', raw: JSON.stringify(spec.body, null, 2), options: { raw: { language: 'json' } } } } : {})
    },
    response: []
  };
}

function group(name, description, specs) {
  collection.item.push({ name, description, item: specs.map(make) });
}

group('用户模块', '用户注册、登录、个人资料、统计和成就接口。', [
  { name: '用户注册', method: 'POST', path: '/api/user/register', body: bodies.register, description: '创建新用户账号。username 需要唯一；password 会加密保存；email 为用户邮箱。' },
  { name: '用户登录', method: 'POST', path: '/api/user/login', body: bodies.login, description: '用户登录，成功后返回 data.token。请把 token 写入 Postman 变量 token。' },
  { name: '获取个人资料', method: 'GET', path: '/api/user/profile', auth: true, description: '获取当前登录用户资料，需要 JWT。' },
  { name: '获取个人统计', method: 'GET', path: '/api/user/stats', auth: true, description: '获取当前登录用户浏览、收藏、测验等统计，需要 JWT。' },
  { name: '获取个人成就', method: 'GET', path: '/api/user/achievements', auth: true, description: '获取当前登录用户成就列表，需要 JWT。' }
]);

group('植物模块', '植物列表、详情、统计、分析汇总、分布记录和数据维护接口。', [
  { name: '获取植物列表', method: 'GET', path: '/api/plants', query: [q('page', 1), q('limit', 20), q('keyword', '牡丹'), q('sort', 'latest', true), q('family', 'Rosaceae', true), q('genus', 'Rosa', true)], description: '分页获取植物卡片列表，支持关键字、科、属和排序过滤。' },
  { name: '获取植物统计', method: 'GET', path: '/api/plants/stats', description: '获取植物总数、媒体资源数量、近 30 天活跃用户数等首页统计。' },
  { name: '获取植物分析汇总', method: 'GET', path: '/api/plants/analytics/summary', description: '获取总物种数、热点区域数、受威胁物种数、保护地数量等可视化汇总。' },
  { name: '获取植物详情', method: 'GET', path: '/api/plants/:id', description: '按植物 ID 获取详情，包含分类链、图片、模型、生态指标、详情文本和保护状态。' },
  { name: '获取植物分布记录', method: 'GET', path: '/api/plants/:id/distributions', description: '按植物 ID 获取 WGSRPD 分布记录、国家代码、原生/引种状态和经纬度。' },
  { name: '获取植物观察记录', method: 'GET', path: '/api/plants/:id/observations', description: '按植物 ID 获取观察记录。当前实现复用分布记录查询。' },
  { name: '创建植物', method: 'POST', path: '/api/plants', body: bodies.plant, description: '创建植物基础信息，可同时写入详情字段。taxon_id、中文名、学名等按业务需要填写。' },
  { name: '更新植物', method: 'PUT', path: '/api/plants/:id', body: bodies.plantPatch, description: '按植物 ID 更新基础字段或详情字段，支持部分字段更新。' },
  { name: '删除植物', method: 'DELETE', path: '/api/plants/:id', description: '按植物 ID 删除植物及其详情记录，请谨慎操作。' }
]);

group('分类模块', '分类列表、分类树、懒加载子节点、搜索、科属列表和分类维护接口。', [
  { name: '获取分类列表', method: 'GET', path: '/api/taxa', query: [q('rank', 'species'), q('parent_id', 4, true), q('keyword', 'Rosa', true)], description: '获取分类节点列表，可按级别、父级和关键字筛选。' },
  { name: '获取分类树', method: 'GET', path: '/api/taxa/tree', description: '一次性获取完整分类树，节点包含 children。' },
  { name: '获取分类子节点', method: 'GET', path: '/api/taxa/tree/children', query: [q('parentId', 1)], description: '懒加载分类树子节点；parentId 为空时返回根节点。' },
  { name: '搜索分类节点', method: 'GET', path: '/api/taxa/search', query: [q('q', '蔷薇'), q('limit', 12)], description: '搜索分类节点，返回匹配节点、路径、是否有子节点等。' },
  { name: '获取科列表', method: 'GET', path: '/api/taxa/families', description: '获取有植物记录的科列表及物种数量。' },
  { name: '获取某科下代表属', method: 'GET', path: '/api/taxa/:id/genera', query: [q('limit', 10)], description: '按科分类 ID 或科科学名获取代表属列表。' },
  { name: '获取分类详情', method: 'GET', path: '/api/taxa/:id', description: '按分类 ID 获取详情，包含父节点、子节点和关联植物。' },
  { name: '创建分类', method: 'POST', path: '/api/taxa', body: bodies.taxon, description: '创建分类节点。taxon_rank、scientific_name、chinese_name 必填。' },
  { name: '更新分类', method: 'PUT', path: '/api/taxa/:id', body: bodies.taxonPatch, description: '按分类 ID 更新节点，parent_id 不能指向自身。' },
  { name: '删除分类', method: 'DELETE', path: '/api/taxa/:id', description: '删除分类。若仍有子分类或被植物引用，后端返回 400。' }
]);

group('分类统计模块', '增强版分类树和分类节点统计接口。', [
  { name: '获取带统计的分类树', method: 'GET', path: '/api/taxonomy/tree-with-stats', query: [q('parentId', 1, true)], description: '获取带统计信息的分类树节点，支持 parentId 懒加载。返回 success/data 结构。' },
  { name: '获取分类节点统计详情', method: 'GET', path: '/api/taxonomy/:id/detail', description: '按分类 ID 获取统计详情，如关联物种数和下级节点统计。返回 success/data 结构。' }
]);

group('搜索模块', '植物搜索结果和搜索建议接口。', [
  { name: '搜索植物', method: 'GET', path: '/api/search/plants', query: [q('q', '牡丹'), q('page', 1), q('limit', 10), q('sort', 'relevance'), q('taxonId', 1, true), q('family', 'Rosaceae', true), q('genus', 'Rosa', true)], description: '植物搜索接口。q 必填；limit 为 1 到 50；sort 支持 relevance、popular、latest、alpha。' },
  { name: '获取搜索建议', method: 'GET', path: '/api/search/suggest', query: [q('q', '牡'), q('limit', 8)], description: '搜索框自动补全接口。q 必填，长度 1 到 30；limit 为 1 到 20。' }
]);

group('收藏模块', '当前登录用户植物收藏接口，全部需要 JWT。', [
  { name: '获取我的收藏', method: 'GET', path: '/api/favorites', auth: true, description: '获取当前登录用户收藏列表。' },
  { name: '查询植物收藏状态', method: 'GET', path: '/api/favorites/status/:plantId', auth: true, description: '查询当前登录用户是否已收藏指定植物。' },
  { name: '新增收藏', method: 'POST', path: '/api/favorites', auth: true, body: bodies.favorite, description: '将指定 plant_id 加入当前用户收藏。' },
  { name: '取消收藏', method: 'DELETE', path: '/api/favorites/:plantId', auth: true, description: '取消当前用户对指定植物的收藏。' }
]);

group('浏览记录模块', '当前登录用户浏览记录和周统计接口，全部需要 JWT。', [
  { name: '获取我的浏览记录', method: 'GET', path: '/api/browse-events', auth: true, query: [q('page', 1), q('limit', 20)], description: '分页获取当前登录用户浏览记录。' },
  { name: '获取本周浏览统计', method: 'GET', path: '/api/browse-events/weekly-stats', auth: true, description: '获取当前登录用户最近一周浏览统计。' },
  { name: '创建浏览记录', method: 'POST', path: '/api/browse-events', auth: true, body: bodies.browse, description: '记录植物浏览行为。plant_id 必填；source 表示来源；duration 表示停留时长。' },
  { name: '删除浏览记录', method: 'DELETE', path: '/api/browse-events/:id', auth: true, description: '删除当前用户的一条浏览记录。' }
]);

group('测验模块', '植物知识测验、答题和答题历史接口。', [
  { name: '获取测验列表', method: 'GET', path: '/api/quizzes', description: '获取测验列表，包含基础信息和题目摘要。' },
  { name: '获取我的全部答题历史', method: 'GET', path: '/api/quizzes/attempts/me', auth: true, description: '获取当前用户所有测验答题历史摘要。' },
  { name: '获取测验详情', method: 'GET', path: '/api/quizzes/:id', description: '按测验 ID 获取完整题目和选项。' },
  { name: '创建测验', method: 'POST', path: '/api/quizzes', body: bodies.quiz, description: '创建测验。title 必填；questions 中每题 stem 必填，options 为选项数组。' },
  { name: '提交测验答案', method: 'POST', path: '/api/quizzes/:id/attempts', auth: true, body: bodies.answers, description: '提交当前用户答案。answers 必须为非空数组，每项包含 question_id 和 chosen_option_id。' },
  { name: '获取某测验我的答题记录', method: 'GET', path: '/api/quizzes/:id/attempts/me', auth: true, description: '获取当前用户在指定测验下的答题记录。' }
]);

group('媒体资源模块', '图片、模型、视频及植物绑定关系维护接口。', [
  { name: '获取媒体资源列表', method: 'GET', path: '/api/media-assets', query: [q('kind', 'image'), q('plant_id', 1, true)], description: '获取媒体资源列表，可按 kind 或 plant_id 过滤。' },
  { name: '获取媒体资源详情', method: 'GET', path: '/api/media-assets/:id', description: '按媒体 ID 获取详情和植物绑定关系。' },
  { name: '创建媒体资源', method: 'POST', path: '/api/media-assets', body: bodies.media, description: '创建媒体资源。kind 和 url 必填；kind 只能为 image、model、video。' },
  { name: '更新媒体资源', method: 'PUT', path: '/api/media-assets/:id', body: bodies.mediaPatch, description: '按媒体 ID 更新 url、尺寸、metadata 等字段。' },
  { name: '删除媒体资源', method: 'DELETE', path: '/api/media-assets/:id', description: '删除媒体资源并清理植物绑定关系。' },
  { name: '绑定媒体到植物', method: 'POST', path: '/api/media-assets/:id/bind', body: bodies.bindMedia, description: '将媒体绑定到植物。plant_id 必填；sort_order 控制展示顺序；caption 为说明。' },
  { name: '解除媒体植物绑定', method: 'DELETE', path: '/api/media-assets/:id/bind/:plantId', description: '解除指定媒体和指定植物之间的绑定。' }
]);

group('红色名录模块', 'IUCN 受威胁物种、预警列表和用户预警状态接口。', [
  { name: '获取受威胁物种列表', method: 'GET', path: '/api/redlist/threatened-species', query: [q('page', 1), q('limit', 20), q('category', 'EN', true), q('keyword', 'Rosa', true)], description: '分页获取受威胁物种，支持 IUCN 等级和关键字过滤。' },
  { name: '获取受威胁物种统计', method: 'GET', path: '/api/redlist/threatened-species/stats', description: '获取总数、等级分布和种群趋势分布。' },
  { name: '获取受威胁物种详情', method: 'GET', path: '/api/redlist/threatened-species/:id', description: '按受威胁物种记录 ID 获取详情，包含关联植物和分类。' },
  { name: '获取公共预警列表', method: 'GET', path: '/api/redlist/alerts', query: [q('page', 1), q('limit', 20), q('unreadOnly', false, true), q('alertLevel', 'high', true), q('changeType', 'upgraded', true)], description: '获取公共红色名录预警列表，不叠加用户状态。' },
  { name: '获取我的预警列表', method: 'GET', path: '/api/redlist/alerts/me', auth: true, query: [q('page', 1), q('limit', 20), q('unreadOnly', false, true), q('includeDismissed', false, true), q('alertLevel', 'high', true), q('changeType', 'upgraded', true)], description: '获取当前用户视角的预警列表，叠加已读和已忽略状态。' },
  { name: '获取我的未读预警数', method: 'GET', path: '/api/redlist/alerts/unread-count', auth: true, description: '获取当前用户未读且未忽略的预警数量。' },
  { name: '全部标记为已读', method: 'POST', path: '/api/redlist/alerts/read-all', auth: true, description: '将所有预警对当前用户标记为已读。' },
  { name: '标记单条预警已读', method: 'POST', path: '/api/redlist/alerts/:id/read', auth: true, description: '将指定预警标记为当前用户已读。' },
  { name: '忽略单条预警', method: 'POST', path: '/api/redlist/alerts/:id/dismiss', auth: true, description: '忽略指定预警，同时标记为已读。' },
  { name: '恢复单条预警', method: 'POST', path: '/api/redlist/alerts/:id/restore', auth: true, description: '恢复之前忽略的预警，并重置为未读。' }
]);

group('保护地模块', 'WDPA 保护地列表、详情和统计接口。', [
  { name: '获取保护地列表', method: 'GET', path: '/api/protected-areas', query: [q('page', 1), q('limit', 20), q('keyword', 'National Park', true), q('iso3', 'CHN', true), q('siteType', 'PA', true), q('iucnCategory', 'II', true), q('status', 'Designated', true), q('realm', 'Palearctic', true)], description: '分页获取保护地，支持国家、类型、类别、状态、生态地理界和关键字过滤。' },
  { name: '获取保护地统计', method: 'GET', path: '/api/protected-areas/stats', query: [q('iso3', 'CHN', true), q('siteType', 'PA', true), q('iucnCategory', 'II', true), q('status', 'Designated', true), q('realm', 'Palearctic', true)], description: '获取保护地总数，以及按 IUCN 类别、站点类型、生态地理界分组统计。' },
  { name: '获取保护地详情', method: 'GET', path: '/api/protected-areas/:siteId', description: '按 WDPA site_id 获取保护地详情，siteId 必须为正整数。' }
]);

group('WCVP分析模块', '植物分布热力图、多样性、热点区域和区域保护摘要接口。', [
  { name: '获取分布热力图数据', method: 'GET', path: '/api/wcvp-analytics/heatmap', query: [q('limit', 500)], description: '获取区域物种数量、原生/引种数量、高风险物种数量和保护地数量。' },
  { name: '获取多样性分布', method: 'GET', path: '/api/wcvp-analytics/diversity', query: [q('groupBy', 'family')], description: '获取物种多样性占比，支持 family、division、phylum 分组。' },
  { name: '获取热点区域排行', method: 'GET', path: '/api/wcvp-analytics/hotspots', query: [q('limit', 30)], description: '获取物种记录数量最高的 WGSRPD Level 3 热点区域。' },
  { name: '获取区域保护摘要', method: 'GET', path: '/api/wcvp-analytics/region-protection-summary', query: [q('areaCode', 'CHC')], description: '按 WGSRPD Level 3 区域代码获取物种、受威胁物种和保护地摘要。areaCode 必填。' }
]);

group('后台管理模块', '中文名翻译和人工维护接口，全部需要 JWT。', [
  { name: '获取中文名翻译统计', method: 'GET', path: '/api/admin/translation/stats', auth: true, description: '获取中文名映射、翻译缓存、覆盖率等统计。' },
  { name: '获取未匹配中文名植物', method: 'GET', path: '/api/admin/translation/unmatched', auth: true, query: [q('limit', 100)], description: '获取缺少中文名或待补全的植物列表。' },
  { name: '手动更新植物中文名', method: 'POST', path: '/api/admin/translation/update', auth: true, body: bodies.translation, description: '人工更新植物中文名，并写入中文名缓存。plantId 和 chineseName 必填。' }
]);

const outputPath = path.join(__dirname, '..', 'docs', 'postman', '知拾植物系统接口文档.postman_collection.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
console.log(outputPath);
