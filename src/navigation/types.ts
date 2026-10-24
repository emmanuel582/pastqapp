import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import type { MainTab } from "../components/BottomNav";
export type Routes = {
  Welcome: undefined;
  Auth: { mode: "login" | "signup" | "reset" | "recovery" };
  Onboarding: undefined;
  Main: { tab?: MainTab } | undefined;
  Setup: { bundleId: string };
  Download: {
    ids: string[];
    title: string;
    mode?: "all" | "select" | "resume";
  };
  Exam: {
    attemptId: string;
    review?: boolean;
    questionIndex?: number;
    reviewFilter?: import("../domain/review").ReviewFilter;
  };
  Results: { attemptId: string };
  Upload: undefined;
  Manual: undefined;
  Processing: { sessionId: string };
  ReviewMaterial: { sessionId: string };
  Theme: undefined;
  Reminders: undefined;
  Notifications: undefined;
  History: undefined;
  Progress: undefined;
  Saved: undefined;
  Storage: undefined;
  Reports: undefined;
  Profile: undefined;
  About: undefined;
  Support: undefined;
};
export type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;
export type Navigation = NativeStackNavigationProp<Routes>;
