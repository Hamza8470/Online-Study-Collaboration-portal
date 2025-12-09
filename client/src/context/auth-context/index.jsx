import { Skeleton } from "@/components/ui/skeleton";
import { initialSignInFormData, initialSignUpFormData } from "@/config";
import { checkAuthService, loginService, registerService, forgotPasswordService } from "@/services";
import { createContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const { toast } = useToast();
  const [signInFormData, setSignInFormData] = useState(initialSignInFormData);
  const [signUpFormData, setSignUpFormData] = useState(initialSignUpFormData);
  const [auth, setAuth] = useState({
    authenticate: false,
    user: null,
  });
  const [loading, setLoading] = useState(true);

  async function handleRegisterUser(event) {
    event.preventDefault();
    try {
      const data = await registerService(signUpFormData);

      if (data.success) {
        toast({
          title: "Success!",
          description: "Registration successful. You can now sign in.",
        });
        setSignUpFormData(initialSignUpFormData);
      } else {
        toast({
          title: "Registration Failed",
          description: data.message || "Registration failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Registration Failed",
        description: error?.response?.data?.message || "Registration failed due to server error",
        variant: "destructive",
      });
    }
  }

  async function handleLoginUser(event) {
    event.preventDefault();
    try {
      const data = await loginService(signInFormData);

      if (data.success) {
        sessionStorage.setItem(
          "accessToken",
          JSON.stringify(data.data.accessToken)
        );
        setAuth({
          authenticate: true,
          user: data.data.user,
        });
        setSignInFormData(initialSignInFormData);
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
      } else {
        toast({
          title: "Login Failed",
          description: data.message || "Login failed. Please check your credentials.",
          variant: "destructive",
        });
        setAuth({
          authenticate: false,
          user: null,
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error?.response?.data?.message || "Login failed due to server error. Please try again.",
        variant: "destructive",
      });
      setAuth({
        authenticate: false,
        user: null,
      });
    }
  }

  async function handleForgotPassword(email) {
    try {
      if (!email) {
        toast({
          title: "Email Required",
          description: "Please enter your email address",
          variant: "destructive",
        });
        return { success: false };
      }
      const data = await forgotPasswordService({ userEmail: email });
      if (data.success) {
        toast({
          title: "Email Sent",
          description: data.message || "If an account with that email exists, a password reset link has been sent.",
        });
        return { success: true };
      } else {
        toast({
          title: "Failed",
          description: data.message || "Failed to send reset email",
          variant: "destructive",
        });
        return { success: false };
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to submit forgot password request",
        variant: "destructive",
      });
      return { success: false };
    }
  }

  //check auth user

  async function checkAuthUser() {
    try {
      const data = await checkAuthService();
      if (data.success) {
        setAuth({
          authenticate: true,
          user: data.data.user,
        });
        setLoading(false);
      } else {
        setAuth({
          authenticate: false,
          user: null,
        });
        setLoading(false);
      }
    } catch (error) {
      console.log(error);
      if (!error?.response?.data?.success) {
        setAuth({
          authenticate: false,
          user: null,
        });
        setLoading(false);
      }
    }
  }

  function resetCredentials() {
    setAuth({
      authenticate: false,
      user: null,
    });
  }

  useEffect(() => {
    checkAuthUser();
  }, []);

  console.log(auth, "gf");

  return (
    <AuthContext.Provider
      value={{
          handleForgotPassword,
        signInFormData,
        setSignInFormData,
        signUpFormData,
        setSignUpFormData,
        handleRegisterUser,
        handleLoginUser,
        auth,
        resetCredentials,
      }}
    >
      {loading ? <Skeleton /> : children}
    </AuthContext.Provider>
  );
}
