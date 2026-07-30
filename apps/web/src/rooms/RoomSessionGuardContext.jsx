import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Exactly one route (and so at most one room page) is ever mounted at a
// time, so a single shared slot is enough -- no stack/registry needed.
const RoomSessionGuardContext = createContext({ active: false, message: null });

export function RoomSessionGuardProvider({ children }) {
  const [guard, setGuard] = useState({ active: false, message: null });
  const value = useMemo(() => ({ guard, setGuard }), [guard]);
  return (
    <RoomSessionGuardContext.Provider value={value}>{children}</RoomSessionGuardContext.Provider>
  );
}

// Read hook for anything that needs to know whether it's safe to navigate
// away right now (AppShell's nav links and log-out button).
export function useRoomSessionGuard() {
  const { guard } = useContext(RoomSessionGuardContext);
  return guard;
}

// Write hook for the page that owns the session in progress (LobbyPage).
// Registers the guard while `active` is true and unconditionally clears it
// on unmount or once `active` turns false, so a guard can never outlive the
// page that raised it.
export function useSetRoomSessionGuard(active, message) {
  const { setGuard } = useContext(RoomSessionGuardContext);

  useEffect(() => {
    setGuard(active ? { active: true, message } : { active: false, message: null });
    return () => setGuard({ active: false, message: null });
  }, [active, message, setGuard]);
}
