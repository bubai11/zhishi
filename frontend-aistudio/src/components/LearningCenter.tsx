import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, History, Info, Star, Trash2, Trophy, XCircle } from 'lucide-react';
import {
  deleteFavorite,
  getBrowseHistory,
  getFavorites,
  getQuizAttemptHistory,
  getQuizById,
  getQuizzes,
  getWeeklyActivity,
  register,
  submitQuizAttempt
} from '../api';
import type { BrowseRecord, Favorite, Quiz, QuizAttempt, QuizResult, WeeklyActivity } from '../types';

interface LearningCenterProps {
  setCurrentPage: (page: string) => void;
  token: string | null;
  onLogin: (username: string, password: string) => Promise<void>;
  onSelectPlant: (plantId: string) => void;
}

type AuthMode = 'login' | 'register';
type TabKey = 'favorites' | 'history' | 'quizzes';

export default function LearningCenter({ token, onLogin, onSelectPlant }: LearningCenterProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('favorites');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<BrowseRecord[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizRecords, setQuizRecords] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!token) return;

    setError(null);
    setLoading(true);

    const task =
      activeTab === 'favorites'
        ? getFavorites(token).then(setFavorites)
        : activeTab === 'history'
          ? Promise.all([getBrowseHistory(token), getWeeklyActivity(token)]).then(([historyData, activityData]) => {
              setHistory(historyData);
              setWeeklyActivity(activityData);
            })
          : Promise.all([getQuizzes(), getQuizAttemptHistory(token)]).then(([quizData, historyData]) => {
              setQuizzes(quizData);
              setQuizRecords(historyData);
            });

    task
      .catch((err) => {
        setError(err instanceof Error ? err.message : '学习中心数据加载失败');
        if (activeTab === 'favorites') setFavorites([]);
        if (activeTab === 'history') {
          setHistory([]);
          setWeeklyActivity([]);
        }
        if (activeTab === 'quizzes') {
          setQuizzes([]);
          setQuizRecords([]);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeTab, token]);

  const handleRemoveFavorite = async (plantId: string) => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteFavorite(plantId, token);
      setFavorites((items) => items.filter((item) => item.plant_id !== plantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消收藏失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartQuiz = async (quizId: string) => {
    setLoading(true);
    setError(null);
    try {
      const quiz = await getQuizById(quizId);
      setSelectedQuiz(quiz);
      setSelectedAnswers({});
      setQuizResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '测验加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!token || !selectedQuiz) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: Object.entries(selectedAnswers).map(([questionId, chosenOptionId]) => ({
          question_id: Number(questionId),
          chosen_option_id: Number(chosenOptionId)
        }))
      };
      const result = await submitQuizAttempt(selectedQuiz.id, payload, token);
      setQuizResult(result);
      const historyData = await getQuizAttemptHistory(token);
      setQuizRecords(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交测验失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthSubmit = async () => {
    setSubmitting(true);
    setAuthMessage(null);
    setError(null);

    try {
      if (authMode === 'register') {
        await register(username, email, password);
        setAuthMessage('注册成功，正在自动登录。');
      }
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : authMode === 'register' ? '注册失败' : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    const submitDisabled = !username || !password || (authMode === 'register' && !email) || submitting;

    return (
      <div className="mx-auto max-w-xl px-8 py-20">
        <div className="space-y-6 rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-3xl font-headline font-bold text-zinc-900">
              {authMode === 'login' ? '学习中心登录' : '创建学习账号'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              登录后即可联动收藏、浏览历史、周活跃度和知识测验。没有账号时也可以直接在这里注册。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-1">
            <button
              onClick={() => setAuthMode('login')}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${authMode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-zinc-500'}`}
            >
              登录
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${authMode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-zinc-500'}`}
            >
              注册
            </button>
          </div>

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {authMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{authMessage}</div>}

          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3"
            placeholder="用户名"
          />
          {authMode === 'register' && (
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3"
              placeholder="邮箱"
            />
          )}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3"
            placeholder="密码"
            type="password"
          />

          <button
            onClick={handleAuthSubmit}
            disabled={submitDisabled}
            className="w-full rounded-2xl bg-emerald-600 py-3 font-bold text-white transition-all disabled:bg-emerald-300"
          >
            {submitting ? '提交中...' : authMode === 'login' ? '登录并继续' : '注册并登录'}
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = selectedQuiz?.questions.length || 0;
  const answeredQuestions = Object.keys(selectedAnswers).length;
  const canSubmitQuiz = totalQuestions > 0 && answeredQuestions === totalQuestions && !submitting;
  const correctRate = quizResult && quizResult.total > 0
    ? Math.round((quizResult.correct_count / quizResult.total) * 100)
    : null;
  const incorrectResults = quizResult?.results.filter((item) => !item.correct) || [];

  return (
    <div className="max-w-screen-2xl mx-auto px-8 py-12">
      <section className="mb-12 rounded-3xl bg-zinc-900 p-10 text-white">
        <h1 className="text-2xl font-headline font-bold">学习交互与管理中心</h1>
        <p className="mt-2 text-sm text-zinc-400">集中管理收藏植物、浏览轨迹与知识测验记录。</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">学习路径</div>
            <div className="mt-2 text-sm text-zinc-200">先收藏感兴趣植物，再查看记录，最后用测验检验掌握情况。</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">交互闭环</div>
            <div className="mt-2 text-sm text-zinc-200">每次浏览和答题结果都会回到个人学习轨迹里，形成可追踪的学习过程。</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">推荐节奏</div>
            <div className="mt-2 text-sm text-zinc-200">{'分类理解 -> 物种认识 -> 保护意识 -> 测验巩固。'}</div>
          </div>
        </div>
      </section>

      {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>}

      <nav className="mb-10 flex flex-wrap items-center gap-3 border-b border-zinc-100 pb-4">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${activeTab === 'favorites' ? 'bg-emerald-50 text-emerald-700' : 'text-zinc-500 hover:bg-zinc-50'}`}
        >
          <Star size={16} />
          收藏学习
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${activeTab === 'history' ? 'bg-emerald-50 text-emerald-700' : 'text-zinc-500 hover:bg-zinc-50'}`}
        >
          <History size={16} />
          学习记录
        </button>
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${activeTab === 'quizzes' ? 'bg-emerald-50 text-emerald-700' : 'text-zinc-500 hover:bg-zinc-50'}`}
        >
          <Trophy size={16} />
          知识测验
        </button>
      </nav>

      {activeTab === 'favorites' && (
        <section className="space-y-8">
          <h2 className="text-2xl font-headline font-bold text-zinc-900">收藏列表</h2>
          {loading ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
              正在加载收藏...
            </div>
          ) : favorites.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
              当前还没有收藏植物，先去植物库挑几种感兴趣的植物。
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {favorites.map((plant) => (
                <div key={plant.plant_id} className="relative flex gap-4 rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
                  <button className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100" onClick={() => onSelectPlant(plant.plant_id)}>
                    {plant.cover_image ? (
                      <img src={plant.cover_image} alt={plant.chinese_name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-500">暂无图片</div>
                    )}
                  </button>
                  <div className="flex flex-grow flex-col justify-center">
                    <h3 className="font-bold text-zinc-900">{plant.chinese_name}</h3>
                    <p className="mb-2 text-xs italic text-zinc-500">{plant.scientific_name}</p>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{plant.category || '未分类'}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveFavorite(plant.plant_id)}
                    disabled={submitting}
                    className="absolute right-4 top-4 p-2 text-zinc-300 transition-colors hover:text-rose-500 disabled:text-zinc-200"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <section className="space-y-8">
          <h2 className="text-2xl font-headline font-bold text-zinc-900">最近学习记录</h2>
          {loading ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
              正在加载浏览记录...
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {history.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
                    暂无浏览记录，进入植物详情页后会开始累计。
                  </div>
                ) : (
                  history.map((record) => (
                    <div key={record.plant_id} className="flex items-center justify-between rounded-3xl border border-zinc-100 bg-white p-6">
                      <div className="flex items-center gap-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-400">
                          <BookOpen size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-zinc-900">{record.plant_name}</h3>
                          <p className="text-xs text-zinc-500">最后浏览：{record.last_viewed_at}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-headline font-extrabold text-zinc-900">{record.view_count}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">浏览次数</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-3xl border border-zinc-100 bg-white p-6">
                <h3 className="mb-4 font-bold text-zinc-900">近 7 天活跃度</h3>
                {weeklyActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                    暂无活跃度数据。
                  </div>
                ) : (
                  <div className="flex h-32 items-end gap-2">
                    {weeklyActivity.map((item) => (
                      <div key={item.day} className="flex-1 text-center">
                        <div className="w-full rounded-t-sm bg-emerald-500/20">
                          <div className="w-full rounded-t-sm bg-emerald-500" style={{ height: `${Math.max(item.value, 8)}px` }} />
                        </div>
                        <div className="mt-2 text-[10px] text-zinc-400">{item.day}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === 'quizzes' && (
        <section className="space-y-8">
          {!selectedQuiz ? (
            <>
              <h2 className="text-2xl font-headline font-bold text-zinc-900">可用测验</h2>
              {loading ? (
                <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
                  正在加载测验列表...
                </div>
              ) : quizzes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500">
                  暂无可用测验。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {quizzes.map((quiz) => (
                    <button key={quiz.id} onClick={() => handleStartQuiz(quiz.id)} className="rounded-3xl border border-zinc-100 bg-white p-8 text-left hover:border-emerald-200">
                      <div className="text-xl font-headline font-bold text-zinc-900">{quiz.title}</div>
                      <div className="mt-2 text-sm text-zinc-500">点击开始答题</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-3xl border border-zinc-100 bg-white p-8">
                <h3 className="mb-4 font-bold text-zinc-900">历史成绩</h3>
                {quizRecords.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                    暂无历史测验记录。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quizRecords.map((record, index) => (
                      <div key={`${record.date}-${index}`} className="flex items-center justify-between border-b border-zinc-50 py-2 last:border-0">
                        <div>
                          <div className="text-sm font-bold text-zinc-800">{record.topic}</div>
                          <div className="text-[10px] text-zinc-400">{record.date}</div>
                        </div>
                        <div className="text-lg font-headline font-black text-emerald-600">{record.score}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-8 rounded-3xl border border-zinc-100 bg-white p-10 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-headline font-bold text-zinc-900">{selectedQuiz.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    已作答 {answeredQuestions}/{totalQuestions}
                  </p>
                </div>
                <button onClick={() => setSelectedQuiz(null)} className="text-sm text-zinc-400 hover:text-zinc-700">
                  返回列表
                </button>
              </div>

              {selectedQuiz.questions.map((question) => (
                <div key={question.id} className="space-y-4 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-5">
                  <div className="font-bold text-zinc-900">{question.question}</div>
                  <div className="grid gap-3">
                    {question.options.map((option, index) => {
                      const optionId = question.option_ids[index];
                      const selected = selectedAnswers[question.id] === optionId;
                      const result = quizResult?.results.find((item) => item.question_id === question.id);
                      const correct = result?.correct_answer === index;
                      return (
                        <button
                          key={`${question.id}-${index}`}
                          disabled={Boolean(quizResult)}
                          onClick={() => setSelectedAnswers((value) => ({ ...value, [question.id]: optionId }))}
                          className={`w-full rounded-2xl border-2 p-4 text-left font-bold transition-all ${
                            quizResult
                              ? correct
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : selected
                                  ? 'border-rose-500 bg-rose-50 text-rose-700'
                                  : 'border-zinc-100 bg-white text-zinc-400'
                              : selected
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                : 'border-zinc-100 bg-white hover:border-emerald-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <span>{option}</span>
                            {quizResult && correct && <CheckCircle2 size={18} />}
                            {quizResult && selected && !correct && <XCircle size={18} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {quizResult && (
                    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                        <Info size={16} />
                        解析
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{question.analysis || '暂无解析。'}</p>
                    </div>
                  )}
                </div>
              ))}

              {!quizResult ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={!canSubmitQuiz}
                  className="w-full rounded-2xl bg-zinc-900 py-3 font-bold text-white transition-all disabled:bg-zinc-300"
                >
                  {submitting ? '提交中...' : canSubmitQuiz ? '提交答案' : '请先完成全部题目'}
                </button>
              ) : (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div className="text-5xl font-headline font-black text-emerald-600">{quizResult.score}</div>
                  <div className="mt-2 text-sm text-zinc-600">
                    共 {quizResult.total} 题，答对 {quizResult.correct_count} 题
                  </div>
                </div>
              )}

              {quizResult && (
                <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
                  <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-6">
                    <h4 className="text-lg font-headline font-bold text-zinc-900">学习反馈</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">正确率</div>
                        <div className="mt-2 text-3xl font-headline font-black text-emerald-600">{correctRate ?? '--'}%</div>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">错题数</div>
                        <div className="mt-2 text-3xl font-headline font-black text-rose-600">{incorrectResults.length}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">建议动作</div>
                        <div className="mt-2 text-sm font-bold text-zinc-700">{incorrectResults.length === 0 ? '进入下一套测验' : '回看解析并复习'}</div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-zinc-600">
                      {incorrectResults.length === 0
                        ? '本次测验掌握情况较好，可以继续浏览更多植物，或进入可视化分析页，建立对分类与保护主题的整体理解。'
                        : `本次仍有 ${incorrectResults.length} 道题需要加强，建议结合题目解析回看相关植物知识点，再重新尝试测验。`}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-100 bg-white p-6">
                    <h4 className="text-lg font-headline font-bold text-zinc-900">继续学习</h4>
                    <div className="mt-4 space-y-3">
                      <button onClick={() => setActiveTab('history')} className="w-full rounded-2xl bg-zinc-900 py-3 text-sm font-bold text-white hover:bg-zinc-800">
                        回看最近学习记录
                      </button>
                      <button onClick={() => setActiveTab('favorites')} className="w-full rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                        复习收藏植物
                      </button>
                      <button onClick={() => setSelectedQuiz(null)} className="w-full rounded-2xl bg-zinc-100 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-200">
                        返回测验列表
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
