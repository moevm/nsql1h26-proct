import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

type ModalState = {
  title: string;
  content: ReactNode;
} | null;

type ModalContextValue = {
  openModal: (title: string, content: ReactNode) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((title: string, content: ReactNode) => setModal({ title, content }), []);
  const value = useMemo(() => ({ openModal, closeModal }), [closeModal, openModal]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3>{modal.title}</h3>
              <button className="button button_secondary" onClick={closeModal}>
                Закрыть
              </button>
            </div>
            {modal.content}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useModal must be used inside ModalProvider");
  return context;
}
