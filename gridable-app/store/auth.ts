import { defineStore } from 'pinia';

export interface UserProfile {
  did: string; // Decentralized Identifier
  displayName: string;
  avatarUrl?: string;
  // other profile information
}

interface AuthState {
  isAuthenticated: boolean;
  currentUser: UserProfile | null;
  loading: boolean;
  error: string | null;
}

// Mock DID for placeholder
const MOCK_USER_DID = 'did:example:123456789abcdefghi';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    isAuthenticated: false,
    currentUser: null,
    loading: false,
    error: null,
  }),
  getters: {
    userDisplayName(state): string {
      return state.currentUser?.displayName || 'Guest';
    },
    userAvatar(state): string | undefined {
      return state.currentUser?.avatarUrl;
    }
  },
  actions: {
    // Simulate login
    async login(displayName: string = 'Mock User') {
      this.loading = true;
      this.error = null;
      // Simulate async call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real scenario, this would involve DID authentication
      this.currentUser = {
        did: MOCK_USER_DID,
        displayName: displayName,
        avatarUrl: 'https://cdn.vuetifyjs.com/images/john.jpg' // Placeholder avatar
      };
      this.isAuthenticated = true;
      this.loading = false;
      console.log('User logged in (mock):', this.currentUser);
    },
    // Simulate logout
    async logout() {
      this.loading = true;
      // Simulate async call
      await new Promise(resolve => setTimeout(resolve, 500));

      this.currentUser = null;
      this.isAuthenticated = false;
      this.loading = false;
      console.log('User logged out (mock)');
    },
    // Action to set an error (e.g., if login fails)
    setError(errorMessage: string) {
      this.error = errorMessage;
    }
    // Later, add actions for managing 3rd party authenticators associated with the DID
  }
});
