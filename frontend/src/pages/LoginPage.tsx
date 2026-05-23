import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BarChart3, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, TextInput, Checkbox } from "@gravity-ui/uikit";
import { useAuth } from "../app/providers/AuthProvider";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/results" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#4f46e5] via-[#6366f1] to-[#818cf8] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]">
          <svg viewBox="0 0 500 500" className="w-full h-full opacity-20">
            <circle cx="150" cy="200" r="60" fill="white" opacity="0.3" />
            <circle cx="250" cy="150" r="40" fill="white" opacity="0.2" />
            <circle cx="320" cy="280" r="70" fill="white" opacity="0.25" />
            <circle cx="180" cy="330" r="45" fill="white" opacity="0.2" />
            <circle cx="380" cy="180" r="35" fill="white" opacity="0.15" />
            {[
              [120,180],[140,220],[160,190],[135,205],[170,210],
              [240,140],[260,160],[245,155],[255,145],
              [300,260],[340,290],[310,300],[330,270],[350,280],[315,285],
              [170,320],[190,340],[175,350],[200,330],
              [370,170],[390,190],[385,175],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4" fill="white" opacity="0.6" />
            ))}
            <line x1="150" y1="200" x2="250" y2="150" stroke="white" opacity="0.1" strokeWidth="1" />
            <line x1="250" y1="150" x2="320" y2="280" stroke="white" opacity="0.1" strokeWidth="1" />
            <line x1="320" y1="280" x2="180" y2="330" stroke="white" opacity="0.1" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-[18px]" style={{ fontWeight: 600 }}>Аналитика сессий экзаменов</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-white text-[32px]" style={{ fontWeight: 600, lineHeight: 1.2 }}>
            Выявляйте нестандартное поведение студентов на экзаменах
          </h1>
          <p className="text-white/70 text-[16px] max-w-md" style={{ lineHeight: 1.6 }}>
            Загружайте журналы Moodle и данные распознавания лиц, стройте сессии, кластеризуйте поведение и анализируйте аномалии.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-white/40 text-[12px]">&copy; 2026 Аналитика сессий экзаменов</p>
        </div>
      </div>

      <div className="flex-1 bg-[#f9fafb] flex items-center justify-center p-8">
        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8 space-y-6">
            <div className="space-y-2 text-center">
              <div className="lg:hidden flex justify-center mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
              <h2 className="text-[22px]" style={{ fontWeight: 600 }}>Добро пожаловать</h2>
              <p className="text-muted-foreground text-[14px]">Войдите чтобы продолжить</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] text-foreground">Электронная почта</label>
                <TextInput
                  type="email"
                  placeholder="name@university.edu"
                  value={email}
                  onUpdate={setEmail}
                  size="m"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] text-foreground">Пароль</label>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  placeholder="Введите пароль"
                  value={password}
                  onUpdate={setPassword}
                  size="m"
                  endContent={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="flex items-center px-1"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Checkbox
                  checked={remember}
                  onUpdate={setRemember}
                  content="Запомнить меня"
                />
                <button type="button" className="text-[13px] text-primary hover:underline">
                  Забыли пароль?
                </button>
              </div>

              {error && <div className="text-[13px] text-destructive">{error}</div>}
              <Button
                type="submit"
                view="action"
                size="l"
                width="max"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Вход...
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>

            <p className="text-center text-[12px] text-muted-foreground">
              Доступ для преподавателей и администраторов
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
