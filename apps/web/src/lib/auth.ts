import { api } from "./api";

type LoginResponse = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  token: string;
  expiresAt: string;
};

type MeResponse = {
  id: string;
  email: string;
  name: string;
  activeInstitutionId: string;
  role: string;
};

export async function getMe(): Promise<MeResponse> {
  return api<MeResponse>("/auth/me");
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse["user"]> {
  const data = await api<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  localStorage.setItem("accessToken", data.token);
  localStorage.setItem("token", data.token);

  return data.user;
}