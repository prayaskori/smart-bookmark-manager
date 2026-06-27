# AI Bookmark Manager (Mobile App)

Cross-platform React Native mobile app built with Expo and Supabase — features real-time bookmark sync, OAuth2 authentication, and persistent sessions via AsyncStorage.

## Features

- **Smart URL Preview Cards**: Automatically fetches page titles (HTML `<title>`) and constructs Google S2 favicon URLs when adding. Displays favicons, page titles, clean domain names, and formatted short dates (e.g. "Jun 27").
- **Live Search Bar**: Search bar at the top of the bookmarks list to filter cards in real-time by title and URL, with result count and clear query button.
- **Pill Categories & Tag Filters**: Pill tags selection (Work, Learning, Tools, Reading, Other) on add, displayed as color-coded badges on cards. Filter bookmarks by clicking a horizontal category filter row at the top.
- **Swipe-to-Delete with Bottom Sheet**: Swipe left on cards to expose deep-red delete triggers, opening a sliding bottom sheet confirmation overlay with spring-action slide physics.
- **Haptics & Slide Spring Micro-interactions**: Haptic vibration feedback on saves, and new list items float up with spring animations on mount.
- **Profile / Stats Dashboard Tab**: Displays active email, date joined, and a tag distribution breakdown chart drawn with pure React Native components.
- **Offline Cache Persistence**: Caches lists in AsyncStorage, immediately loading them on boot and syncing fresh data from Supabase in the background.

---

## Technical Stack

- **Framework**: Expo (React Native SDK 54)
- **Database / Auth Backend**: Supabase JS Client v2
- **Routing**: React Navigation (Bottom Tab Navigator)
- **Session & Caching**: AsyncStorage
- **Gestures**: React Native Gesture Handler (Swipeable)
- **Icons**: Expo Vector Icons (Ionicons)

---

## Setup Instructions

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Git](https://git-scm.com/)
- Expo Go App installed on your physical mobile device, OR an Android/iOS emulator configured.

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd smartbookmark
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   *Note: Native dependencies were installed using `npx expo install` to guarantee compatibility with Expo SDK 56.*

3. **Verify Configuration**:
   The database is pre-configured in `src/config/supabase.js` using the following Supabase instance:
   - Supabase URL: `https://dmnekbvexwxpziuopcso.supabase.co`

---

## Running the Application

### Running on Android

To run the application on an Android device or emulator:

1. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

2. **Open the App on Android**:
   - **For Android Emulator**: Press `a` in the terminal once the server starts. It will automatically detect and boot the app on your running Android Virtual Device (AVD).
   - **For Physical Android Device**: Scan the QR code displayed in the terminal using the **Expo Go** app (downloadable from Google Play Store). Ensure your phone and computer are on the same Wi-Fi network.

### Running on iOS

- **For iOS Simulator** (macOS only): Press `i` in the terminal.
- **For Physical iOS Device**: Scan the QR code using your iOS Camera app (opens Expo Go).

---

## Project Structure

```text
├── App.js                     # Root entry point, manages Auth routing and Tab navigation
├── app.json                   # Expo configuration file
├── package.json               # Project metadata & dependency list
├── README.md                  # Setup and information guide
├── supabase_migration.sql     # Supabase database columns migration SQL script
└── src
    ├── components
    │   └── BookmarkItem.js    # Swipe-to-delete bookmark list item
    ├── config
    │   └── supabase.js        # Supabase client instantiation and AsyncStorage configuration
    └── screens
        ├── AddBookmarkScreen.js # Form to validate, scrape and save bookmarks with tags
        ├── BookmarkListScreen.js # Flatlist with search, horizontal filters and bottom sheet delete
        ├── LoginScreen.js      # Email/Password Sign-In and Sign-Up flows
        └── ProfileScreen.js    # User email, statistics and custom tag breakdown charts
```
