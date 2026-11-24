import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

export const GlobalBatchContext = createContext(null);

export const GlobalBatchProvider = ({ children }) => {
  const auth = useAuth();

  const value = {
    selectedBatch: auth.selectedBatch || auth.activeBatch || null,
    selectedBatchId: auth.selectedBatchId || '',
    selectedBatchName: auth.selectedBatchName || auth.activeBatch?.batchName || '',
    batchesList: auth.batchesList || [],
    isBatchClosed: Boolean(auth.isBatchClosed),
    isLoadingBatches: Boolean(auth.isLoadingBatches),
    isBatchModalOpen: Boolean(auth.isBatchModalOpen),
    openBatchModal: auth.openBatchModal || (() => {}),
    closeBatchModal: auth.closeBatchModal || (() => {}),
    selectBatch: auth.selectBatch || (() => {}),
    clearBatchSelection: auth.clearBatchSelection || (() => {}),
    refreshBatches: auth.fetchGlobalBatches || (() => {}),
  };

  return (
    <GlobalBatchContext.Provider value={value}>
      {children}
    </GlobalBatchContext.Provider>
  );
};

export const useGlobalBatch = () => {
  const context = useContext(GlobalBatchContext);
  const auth = useAuth();

  if (context) {
    return context;
  }

  // Graceful fallback to AuthContext if invoked outside GlobalBatchProvider
  return {
    selectedBatch: auth?.selectedBatch || auth?.activeBatch || null,
    selectedBatchId: auth?.selectedBatchId || '',
    selectedBatchName: auth?.selectedBatchName || auth?.activeBatch?.batchName || '',
    batchesList: auth?.batchesList || [],
    isBatchClosed: Boolean(auth?.isBatchClosed),
    isLoadingBatches: Boolean(auth?.isLoadingBatches),
    isBatchModalOpen: Boolean(auth?.isBatchModalOpen),
    openBatchModal: auth?.openBatchModal || (() => {}),
    closeBatchModal: auth?.closeBatchModal || (() => {}),
    selectBatch: auth?.selectBatch || (() => {}),
    clearBatchSelection: auth?.clearBatchSelection || (() => {}),
    refreshBatches: auth?.fetchGlobalBatches || (() => {}),
  };
};

// Aliases for developer convenience
export const useBatch = useGlobalBatch;

export default GlobalBatchContext;
