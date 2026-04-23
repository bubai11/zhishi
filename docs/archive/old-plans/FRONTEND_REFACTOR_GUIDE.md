# 前端 4 页面 API 联调改造指南

## 总体进度

| 页面 | 状态 | 优先级 | 依赖 |
|------|------|--------|------|
| Classification | 📝 待改造 | 🟡 中 | 无 |
| Analysis | 📝 待改造 | 🟡 中 | 无 |
| LearningCenter | 📝 待改造 | 🔴 高 | 登录/Token |
| UserProfile | 📝 待改造 | 🟡 中 | 登录/Token |

---

## 第 1 步：App.tsx 全局状态改造

### 增加全局认证状态

```typescript
// App.tsx 中增加：
const [token, setToken] = useState<string | null>(() => {
  // 从 localStorage 恢复 token
  return localStorage.getItem('auth_token');
});

const [user, setUser] = useState<{ id: string; username: string } | null>(null);
const [loading, setLoading] = useState(false);

// 登录函数
const handleLogin = async (username: string, password: string) => {
  try {
    setLoading(true);
    const result = await login(username, password);
    setToken(result.token);
    setUser({ id: result.user_id, username: result.username });
    localStorage.setItem('auth_token', result.token);
  } catch (error) {
    console.error('Login failed:', error);
  } finally {
    setLoading(false);
  }
};

const handleLogout = () => {
  setToken(null);
  setUser(null);
  localStorage.removeItem('auth_token');
};

// 传给各页面
<YourPage token={token} user={user} onLogin={handleLogin} onLogout={handleLogout} />
```

---

## 第 2 步：Classification 页面改造（无需认证）

### 改造前（Mock 数据）
```typescript
// Classification.tsx - 现在的样子
const mockTree = {
  id: 'plantae',
  name: '植物界',
  // ... 完整的 mock 结构
};

export default function Classification() {
  const [tree] = useState(mockTree);
  // 直接用 mock 数据
}
```

### 改造后（真实 API）
```typescript
import { getTaxonomy, getGenera } from '../api';
import type { TaxonomyNode, Genus } from '../types';

export default function Classification() {
  const [tree, setTree] = useState<TaxonomyNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<TaxonomyNode | null>(null);
  const [genera, setGenera] = useState<Genus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载完整分类树
  useEffect(() => {
    const loadTree = async () => {
      try {
        setLoading(true);
        const data = await getTaxonomy();
        setTree(data);
        setSelectedNode(data); // 默认选中根节点
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load taxonomy');
      } finally {
        setLoading(false);
      }
    };

    loadTree();
  }, []);

  // 当选中节点时加载其下辖的属
  const handleNodeSelect = async (node: TaxonomyNode) => {
    setSelectedNode(node);
    if (node.id) {
      try {
        const { list } = await getGenera(node.id);
        setGenera(list);
      } catch (err) {
        console.error('Failed to load genera:', err);
      }
    }
  };

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      {/* 左侧树 - 原有的可缩放树组件 */}
      <InteractiveTree
        tree={tree}
        onNodeSelect={handleNodeSelect}
      />

      {/* 右侧面板 - 精选属列表 */}
      <div>
        <h3>{selectedNode?.name} - 精选属</h3>
        <div className="grid">
          {genera.map((genus) => (
            <div key={genus.id} className="card">
              <img src={genus.cover_image} alt={genus.name} />
              <h4>{genus.name}</h4>
              <p>{genus.scientific_name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 第 3 步：Analysis 页面改造（无需认证）

### 改造模式
```typescript
import {
  getAnalyticsSummary,
  getDiversity,
  getHeatmap,
  getAlerts,
} from '../api';

export default function Analysis() {
  // 总结卡片数据
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  
  // 分类学占比图数据
  const [diversity, setDiversity] = useState<DiversityItem[]>([]);
  
  // 区域分布表数据
  const [heatmap, setHeatmap] = useState<RegionalData[]>([]);
  
  // 濒危警报
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  const [loading, setLoading] = useState(false);

  // 一次性加载所有数据（或分别加载）
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const [summaryData, diversityData, heatmapData, alertsData] = await Promise.all([
          getAnalyticsSummary(),
          getDiversity('division'),
          getHeatmap(),
          getAlerts(),
        ]);
        
        setSummary(summaryData);
        setDiversity(diversityData);
        setHeatmap(heatmapData);
        setAlerts(alertsData.alerts);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      {/* 汇总卡片 */}
      <div className="summary-cards">
        <Card>{summary?.total_species}</Card>
        <Card>{summary?.critical_regions}</Card>
        <Card>{summary?.annual_growth_rate}</Card>
        <Card>{summary?.protected_areas}</Card>
      </div>

      {/* 分类学占比条形图 */}
      <BarChart data={diversity} />

      {/* 区域分布表 */}
      <Table data={heatmap} />

      {/* 濒危警报 */}
      <AlertPanel alerts={alerts} />
    </div>
  );
}
```

---

## 第 4 步：LearningCenter 页面改造（需认证）

### 完整改造示例

```typescript
import {
  getFavorites, deleteFavorite,
  getBrowseHistory, getWeeklyActivity,
  getQuizzes, getQuizById, submitQuizAttempt, getQuizAttemptHistory,
} from '../api';

interface LearningCenterProps {
  token: string | null;
}

export default function LearningCenter({ token }: LearningCenterProps) {
  const [activeTab, setActiveTab] = useState<'favorites' | 'history' | 'quiz'>('favorites');
  const [loading, setLoading] = useState(false);

  // ===== Tab 1: 收藏列表
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    if (!token || activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      try {
        setLoading(true);
        const data = await getFavorites(token);
        setFavorites(data);
      } catch (err) {
        console.error('Failed to load favorites:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [token, activeTab]);

  const handleRemoveFavorite = async (plantId: string) => {
    try {
      await deleteFavorite(plantId, token!);
      setFavorites(favorites.filter(f => f.plant_id !== plantId));
    } catch (err) {
      console.error('Failed to remove favorite:', err);
    }
  };

  // ===== Tab 2: 浏览历史 + 周活跃度
  const [history, setHistory] = useState<BrowseRecord[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([]);

  useEffect(() => {
    if (!token || activeTab !== 'history') return;

    const loadHistory = async () => {
      try {
        setLoading(true);
        const [historyData, activityData] = await Promise.all([
          getBrowseHistory(token),
          getWeeklyActivity(token),
        ]);
        setHistory(historyData);
        setWeeklyActivity(activityData);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [token, activeTab]);

  // ===== Tab 3: 知识测试
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    if (activeTab !== 'quiz') return;

    const loadQuizzes = async () => {
      try {
        setLoading(true);
        const data = await getQuizzes();
        setQuizzes(data);
      } catch (err) {
        console.error('Failed to load quizzes:', err);
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, [activeTab]);

  // 加载历史尝试
  useEffect(() => {
    if (!token || !selectedQuiz) return;

    const loadAttempts = async () => {
      try {
        const data = await getQuizAttemptHistory(token);
        setAttempts(data);
      } catch (err) {
        console.error('Failed to load attempts:', err);
      }
    };

    loadAttempts();
  }, [token, selectedQuiz]);

  // 提交答案
  const handleSubmitQuiz = async (answers: Array<{ question_id: number; chosen_option_id: number }>) => {
    if (!selectedQuiz || !token) return;

    try {
      const result = await submitQuizAttempt(selectedQuiz.id, { answers }, token);
      // 显示结果
      console.log(`得分: ${result.score}/${result.total}`);
      // 重新加载历史
      const updatedAttempts = await getQuizAttemptHistory(token);
      setAttempts(updatedAttempts);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    }
  };

  if (!token) {
    return <div>请先登录</div>;
  }

  return (
    <div>
      {/* Tab 切换 */}
      <div className="tabs">
        <button onClick={() => setActiveTab('favorites')}>收藏列表</button>
        <button onClick={() => setActiveTab('history')}>学习记录</button>
        <button onClick={() => setActiveTab('quiz')}>知识测试</button>
      </div>

      {/* Tab 1: 收藏 */}
      {activeTab === 'favorites' && (
        <div>
          {favorites.map(fav => (
            <div key={fav.plant_id} className="favorite-item">
              <img src={fav.cover_image} alt={fav.chinese_name} />
              <div>
                <h4>{fav.chinese_name}</h4>
                <p>{fav.scientific_name}</p>
              </div>
              <button onClick={() => handleRemoveFavorite(fav.plant_id)}>取消收藏</button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: 历史 */}
      {activeTab === 'history' && (
        <div>
          <h3>浏览历史</h3>
          {history.map(record => (
            <div key={record.plant_id}>{record.plant_name} - 浏览 {record.view_count} 次</div>
          ))}

          <h3>周活跃度</h3>
          <BarChart data={weeklyActivity} />
        </div>
      )}

      {/* Tab 3: 测试 */}
      {activeTab === 'quiz' && (
        <div>
          {!selectedQuiz ? (
            <div>
              <h3>可用测试</h3>
              {quizzes.map(quiz => (
                <button key={quiz.id} onClick={() => setSelectedQuiz(quiz)}>
                  {quiz.title}
                </button>
              ))}
            </div>
          ) : (
            <QuizComponent
              quiz={selectedQuiz}
              onSubmit={handleSubmitQuiz}
              onBack={() => setSelectedQuiz(null)}
            />
          )}

          <h3>历史成绩</h3>
          {attempts.map((attempt, i) => (
            <div key={i}>{attempt.date}: {attempt.score} 分</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 第 5 步：UserProfile 页面改造（需认证）

```typescript
interface UserProfileProps {
  token: string | null;
  user: { id: string; username: string } | null;
  onLogout: () => void;
}

export default function UserProfile({ token, user, onLogout }: UserProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    const loadProfile = async () => {
      try {
        setLoading(true);
        const [profileData, statsData, achievementsData] = await Promise.all([
          getUserProfile(token),
          getUserStats(token),
          getUserAchievements(token),
        ]);

        setProfile(profileData);
        setStats(statsData);
        setAchievements(achievementsData);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token]);

  if (!token || !profile) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      {/* 用户信息卡片 */}
      <div className="profile-card">
        <img src={profile.avatar} alt={profile.username} />
        <h2>{profile.username}</h2>
        <p>等级: {profile.level} | 积分: {profile.points}</p>
        <p>{profile.bio}</p>
        <button onClick={onLogout}>退出登录</button>
      </div>

      {/* 成就统计 */}
      <div className="stats">
        <Card>平均答题: {stats?.avg_quiz_score}</Card>
        <Card>连续打卡: {stats?.streak_days} 天</Card>
        <Card>解锁徽章: {stats?.badges_unlocked}</Card>
      </div>

      {/* 勋章列表 */}
      <div className="achievements">
        <h3>成就勋章</h3>
        {achievements.map(ach => (
          <div key={ach.name} className="badge">
            <span>{ach.icon}</span>
            <span>{ach.name}</span>
            <span>{ach.earned_at}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 快速检查清单

### 改造前
- [ ] Classification 使用 mock 数据
- [ ] Analysis 使用 mock 数据
- [ ] LearningCenter 使用 mock 数据
- [ ] UserProfile 使用 mock 数据
- [ ] App.tsx 无认证状态

### 改造后
- [ ] Classification 调用 getTaxonomy() 和 getGenera()
- [ ] Analysis 调用 getAnalyticsSummary()、getDiversity()、getHeatmap()、getAlerts()
- [ ] LearningCenter 调用所有学习相关 API，有 3 个 tab 且都通过 API 加载
- [ ] UserProfile 调用 getUserProfile()、getUserStats()、getUserAchievements()
- [ ] App.tsx 有 token 状态和登录/退出逻辑
- [ ] 所有需要认证的 API 调用都传递了 token

---

## 调试技巧

### 1. 检查 API 是否可达
```bash
curl http://127.0.0.1:3001/api/taxonomy/tree-with-stats
```

### 2. 查看浏览器网络请求
- F12 → Network 标签
- 查看请求 URL、请求头、响应状态

### 3. 检查 Token 是否有效
```typescript
// 在浏览器控制台运行
console.log(localStorage.getItem('auth_token'));
```

### 4. 模拟 API 错误
```typescript
// 在 api.ts 某个函数中临时加入错误
throw new Error('Test error');
```

---

## 后续优化方向

1. **全局状态管理**：如果页面间需要共享数据，考虑用 Context 或状态管理库
2. **缓存策略**：避免重复加载同一数据
3. **分页加载**：长列表考虑虚拟滚动或分页
4. **乐观更新**：收藏/取消收藏立即更新 UI，失败时回滚
5. **错误恢复**：网络错误时提供重试按钮
