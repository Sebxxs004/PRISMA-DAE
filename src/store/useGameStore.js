import { create } from 'zustand';

let timerInterval = null;

const clearTimerInterval = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

const useGameStore = create((set, get) => ({
  cases: [],
  connections: [],
  timer: 0,
  isInvestigating: false,

  setCases: (cases) => set({ cases }),

  addConnection: (sourceId, targetId, type, reason) =>
    set((state) => ({
      connections: [
        ...state.connections,
        {
          id: crypto.randomUUID(),
          source: sourceId,
          target: targetId,
          type,
          reasoning: reason,
        },
      ],
    })),

  startTimer: () => {
    if (get().isInvestigating) {
      return;
    }

    clearTimerInterval();
    set({ isInvestigating: true });

    timerInterval = setInterval(() => {
      if (!get().isInvestigating) {
        clearTimerInterval();
        return;
      }

      set((state) => ({ timer: state.timer + 1 }));
    }, 1000);
  },

  stopTimer: () => {
    clearTimerInterval();
    set({ isInvestigating: false });
  },
}));

export default useGameStore;
