import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { NavigationContainer, useLinkBuilder } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { SavedProvider } from './context/SavedContext';
import { UserProvider } from './context/UserContext';
import Constants from './Constants';

// Screens
import HomeScreen from './screens/HomeScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import SavedScreen from './screens/SavedScreen';
import AlertsScreen from './screens/AlertsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SplashScreen from './screens/SplashScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const brand = Constants.BRAND;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#F97316', // Orange accent from screenshot
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: 85,
          paddingBottom: 20,
          paddingTop: 10,
          elevation: 0,
          backgroundColor: '#FFF'
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 10,
          marginTop: 5
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🏠</Text> }}
      />
      <Tab.Screen
        name="Saved"
        component={SavedScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>❤️</Text> }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🔔</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = React.useState(true);

  // Deep linking configuration
  const prefix = Linking.createURL('/');
  const linking = {
    prefixes: [prefix, 'hollowscan://', 'https://hollowscan.com'],
    config: {
      screens: {
        Root: {
          screens: {
            Home: 'home',
            Saved: 'saved',
            Alerts: 'alerts',
            Profile: 'profile',
          },
        },
        ProductDetail: 'product/:productId',
      },
    },
  };

  return (
    <UserProvider>
      <SavedProvider>
        <SafeAreaProvider>
          {showSplash ? (
            <SplashScreen onComplete={() => setShowSplash(false)} />
          ) : (
            <NavigationContainer linking={linking} fallback={<SplashScreen onComplete={() => { }} />}>
              <StatusBar style="dark" />
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Root" component={TabNavigator} />
                <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ presentation: 'card' }} />
              </Stack.Navigator>
            </NavigationContainer>
          )}
        </SafeAreaProvider>
      </SavedProvider>
    </UserProvider>
  );
}
