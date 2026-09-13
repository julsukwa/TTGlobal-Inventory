export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  token?: string;
};

export const loginUser = async (
  data: LoginPayload
): Promise<LoginResponse> => {
  // 🔥 MOCK API (for now - backend will replace this)

  return new Promise((resolve) => {
    setTimeout(() => {
      if (data.username === "admin" && data.password === "admin") {
        resolve({
          success: true,
          message: "Login successful",
          token: "fake-jwt-token",
        });
      } else {
        resolve({
          success: false,
          message: "Incorrect Username Or Password",
        });
      }
    }, 1000);
  });
};