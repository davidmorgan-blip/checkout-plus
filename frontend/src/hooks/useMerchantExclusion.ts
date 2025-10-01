import { useState, useCallback } from 'react';

/**
 * Custom hook for managing merchant exclusion state and operations
 * Used for temporarily excluding merchants from calculations and summary stats
 *
 * @returns Object containing exclusion state and handler functions
 */
export const useMerchantExclusion = () => {
  const [excludedMerchants, setExcludedMerchants] = useState<Set<string>>(new Set());

  /**
   * Toggles exclusion status for a single merchant
   * @param merchantId - The merchant ID to toggle
   */
  const handleExcludeToggle = useCallback((merchantId: string) => {
    setExcludedMerchants(prev => {
      const newExcluded = new Set(prev);
      if (newExcluded.has(merchantId)) {
        newExcluded.delete(merchantId);
      } else {
        newExcluded.add(merchantId);
      }
      return newExcluded;
    });
  }, []);

  /**
   * Excludes all merchants from the provided list
   * @param merchantIds - Array of merchant IDs to exclude
   */
  const handleSelectAll = useCallback((merchantIds: string[]) => {
    setExcludedMerchants(new Set(merchantIds));
  }, []);

  /**
   * Clears all exclusions
   */
  const handleClearAll = useCallback(() => {
    setExcludedMerchants(new Set());
  }, []);

  /**
   * Manually set the excluded merchants set (useful for auto-exclusion features)
   * @param merchantIds - Set of merchant IDs to exclude or a function that takes the previous set
   */
  const setExcluded = useCallback((merchantIds: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof merchantIds === 'function') {
      setExcludedMerchants(prev => merchantIds(prev));
    } else {
      setExcludedMerchants(merchantIds);
    }
  }, []);

  return {
    excludedMerchants,
    handleExcludeToggle,
    handleSelectAll,
    handleClearAll,
    setExcluded,
  };
};
