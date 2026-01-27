import { useState, useEffect, useCallback } from 'react';
import { SessionHistory, LoggerHistoryConfig } from '@/types/history';
import { DataFile } from '@/types/file';
import { MeasurementSession } from '@/types/temperature';

const HISTORY_STORAGE_KEY = 'temperature-logger-history';
const MAX_HISTORY_ITEMS = 30;

export function useHistory() {
  const [historyItems, setHistoryItems] = useState<SessionHistory[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SessionHistory[];
        // Convert date strings back to Date objects
        const items = parsed.map(item => ({
          ...item,
          savedAt: new Date(item.savedAt),
          sessions: item.sessions.map(s => ({
            ...s,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
          }))
        }));
        setHistoryItems(items);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  // Save history to localStorage
  const saveToStorage = useCallback((items: SessionHistory[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }, []);

  // Save or update a file's session configuration
  const saveHistory = useCallback((file: DataFile, fileContent: string) => {
    // Only save if there are configured loggers (at least one with type set)
    const hasConfiguredLoggers = file.loggers.some(l => l.type !== null);
    if (!hasConfiguredLoggers || file.sessions.length === 0) {
      return;
    }

    const loggerConfigs: LoggerHistoryConfig[] = file.loggers.map(logger => ({
      loggerId: logger.id,
      loggerName: logger.name,
      type: logger.type,
      setTemperature: logger.setTemperature,
      sterilizationType: logger.sterilizationType,
    }));

    const historyItem: SessionHistory = {
      id: `${file.name}-${Date.now()}`,
      fileName: file.name,
      fileContent,
      sessions: file.sessions,
      loggerConfigs,
      savedAt: new Date(),
    };

    setHistoryItems(prev => {
      // Check if this file already exists in history (by name)
      const existingIndex = prev.findIndex(h => h.fileName === file.name);
      
      let updated: SessionHistory[];
      if (existingIndex >= 0) {
        // Update existing entry - move to top with new timestamp
        updated = [historyItem, ...prev.filter((_, i) => i !== existingIndex)].slice(0, MAX_HISTORY_ITEMS);
      } else {
        // Add new entry, keeping max items
        updated = [historyItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      }
      
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Delete a history item
  const deleteHistory = useCallback((historyId: string) => {
    setHistoryItems(prev => {
      const updated = prev.filter(h => h.id !== historyId);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistoryItems([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  return {
    historyItems,
    saveHistory,
    deleteHistory,
    clearHistory,
  };
}
