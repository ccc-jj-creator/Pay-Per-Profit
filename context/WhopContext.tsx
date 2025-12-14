import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Types for Whop context
interface WhopUser {
  id: string;
  username: string;
  email?: string;
  profilePicUrl?: string;
}

interface WhopContextType {
  // User info from Whop
  user: WhopUser | null;

  // Access control - determined by Whop iframe context
  isSeller: boolean;  // true if viewing as seller/admin
  hasAccess: boolean; // true if user has valid membership access

  // Context IDs from Whop
  experienceId: string | null;
  companyId: string | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Refresh function
  refreshContext: () => Promise<void>;
}

const WhopContext = createContext<WhopContextType | null>(null);

// Whop iframe message types
interface WhopIframeMessage {
  type: string;
  data?: unknown;
}

/**
 * WhopProvider - Provides Whop context to the application
 *
 * This integrates with Whop's iframe SDK to:
 * 1. Detect if user is viewing as seller (creator) or customer (buyer)
 * 2. Get user information from Whop
 * 3. Check access permissions
 */
export const WhopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<Omit<WhopContextType, 'refreshContext'>>({
    user: null,
    isSeller: false,
    hasAccess: false,
    experienceId: null,
    companyId: null,
    isLoading: true,
    error: null,
  });

  const initWhop = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Extract context from URL (Whop passes this in iframe URL)
      const url = new URL(window.location.href);
      const pathname = window.location.pathname;

      // Check for experience ID in URL
      const expMatch = pathname.match(/(exp_[a-zA-Z0-9]+)/);
      const bizMatch = pathname.match(/(biz_[a-zA-Z0-9]+)/);

      const experienceId = expMatch?.[1] || url.searchParams.get('experienceId') || null;
      const companyId = bizMatch?.[1] || url.searchParams.get('companyId') || null;

      // Determine view type from URL or parent communication
      // Whop uses different URL patterns for seller vs customer views:
      // - Seller view: /dashboard/biz_xxx/... or contains 'seller' in path
      // - Customer view: /experiences/exp_xxx/... or contains 'customer' in path
      const isSeller = pathname.includes('/dashboard/') ||
                       pathname.includes('/seller') ||
                       pathname.includes('/admin') ||
                       url.searchParams.get('view') === 'seller';

      // Try to get user info from Whop SDK
      let user: WhopUser | null = null;
      let hasAccess = false;

      // Check if we're in a Whop iframe by looking for parent messages
      // or URL parameters that Whop sets
      const userId = url.searchParams.get('userId') || url.searchParams.get('user_id');
      const username = url.searchParams.get('username');

      if (userId) {
        user = {
          id: userId,
          username: username || 'User',
          profilePicUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'User')}&background=random`,
        };
        hasAccess = true; // If Whop passed user ID, they have access
      }

      // If we're in the Whop iframe, listen for context messages
      if (window.parent !== window) {
        // Request context from parent Whop iframe
        window.parent.postMessage({ type: 'whop:getContext' }, '*');

        // Set up listener for Whop messages
        const handleMessage = (event: MessageEvent<WhopIframeMessage>) => {
          if (event.data?.type === 'whop:context') {
            const contextData = event.data.data as {
              user?: WhopUser;
              isSeller?: boolean;
              hasAccess?: boolean;
              experienceId?: string;
              companyId?: string;
            };

            setState(prev => ({
              ...prev,
              user: contextData.user || prev.user,
              isSeller: contextData.isSeller ?? prev.isSeller,
              hasAccess: contextData.hasAccess ?? prev.hasAccess,
              experienceId: contextData.experienceId || prev.experienceId,
              companyId: contextData.companyId || prev.companyId,
            }));
          }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup listener on unmount
        return () => window.removeEventListener('message', handleMessage);
      }

      // For development/testing outside Whop iframe, allow URL param overrides
      const devIsSeller = url.searchParams.get('isSeller') === 'true';

      setState({
        user,
        isSeller: isSeller || devIsSeller,
        hasAccess: hasAccess || !!userId,
        experienceId,
        companyId,
        isLoading: false,
        error: null,
      });

    } catch (error) {
      console.error('[WhopContext] Failed to initialize:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize Whop context',
      }));
    }
  }, []);

  useEffect(() => {
    initWhop();
  }, [initWhop]);

  const contextValue: WhopContextType = {
    ...state,
    refreshContext: initWhop,
  };

  return (
    <WhopContext.Provider value={contextValue}>
      {children}
    </WhopContext.Provider>
  );
};

/**
 * Hook to access Whop context
 * Must be used within a WhopProvider
 */
export const useWhop = (): WhopContextType => {
  const context = useContext(WhopContext);
  if (!context) {
    throw new Error('useWhop must be used within a WhopProvider');
  }
  return context;
};

/**
 * Hook to check if current user is a seller/creator
 * Convenience wrapper around useWhop
 */
export const useIsSeller = (): boolean => {
  const { isSeller, isLoading } = useWhop();
  return !isLoading && isSeller;
};

/**
 * Hook to check if current user has access
 * Convenience wrapper around useWhop
 */
export const useHasAccess = (): boolean => {
  const { hasAccess, isLoading } = useWhop();
  return !isLoading && hasAccess;
};
