import { useState } from "react";
import { useDispatch } from "react-redux";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useLoginMutation } from "../../store/apiSlice";
import { setCredentials } from "../../store/authSlice";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [login, { isLoading: loading }] = useLoginMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await login({
        email,
        password,
      }).unwrap();

      if (response.success) {
        console.log("login successful");
        dispatch(setCredentials(response));
        navigate("/admin-dashboard", { replace: true });
      }

    } catch (err) {
      setError(err.data?.message || "Invalid email or password");
    }
  };

  return (
    <div className="login-canvas">
      <div className="login-shell">
        <div className="login-header">
          <div className="admin-brand">
            <span className="admin-brand-mark">COA</span>
            <span>WhatsApp Automation</span>
          </div>
        </div>

        <div className="login-card">
          <div>
            <p className="admin-eyebrow">Admin sign in</p>
            <h2>Welcome back</h2>
            <p>Use your administrator credentials to continue.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              placeholder="email"
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">
              Password
            </label>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="password"
                className="admin-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button
            type="submit"
            className="admin-primary-button w-full"
            disabled={loading}
          >
            {loading ? (
              <svg
                aria-hidden="true"
                className="w-4 h-4 mx-auto text-center text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 "
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
            ) : (
              "Login"
            )}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
