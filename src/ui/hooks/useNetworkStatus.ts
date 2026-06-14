/**
 * useNetworkStatus — 监听网络状态变化的 React Hook
 */

import { useState, useEffect } from 'react';
import { subscribeNetworkStatus } from '../../utils/offlineCache';

export interface NetworkStatus {
  online: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    return subscribeNetworkStatus(setOnline);
  }, []);

  return { online };
}
