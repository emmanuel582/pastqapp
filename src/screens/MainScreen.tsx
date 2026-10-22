import React, { useState } from "react";
import { View } from "react-native";
import { Screen } from "../components/ui";
import BottomNav, { type MainTab } from "../components/BottomNav";
import HomeScreen from "./HomeScreen";
import LibraryScreen from "./LibraryScreen";
import DiscoverScreen from "./DiscoverScreen";
import PreferencesScreen from "./PreferencesScreen";
import type { Props } from "../navigation/types";
export default function MainScreen({ navigation, route }: Props<"Main">) {
  const [tab, setTab] = useState<MainTab>(route.params?.tab || "home");
  return (
    <Screen>
      <View style={{ flex: 1 }}>
        {tab === "home" ? (
          <HomeScreen
            navigation={navigation}
            onLibrary={() => setTab("library")}
          />
        ) : tab === "library" ? (
          <LibraryScreen navigation={navigation} />
        ) : tab === "discover" ? (
          <DiscoverScreen navigation={navigation} />
        ) : (
          <PreferencesScreen
            navigation={navigation}
            onStudy={() => setTab("library")}
          />
        )}
      </View>
      <BottomNav
        tab={tab}
        onTab={setTab}
        onUpload={() => navigation.navigate("Upload")}
      />
    </Screen>
  );
}
