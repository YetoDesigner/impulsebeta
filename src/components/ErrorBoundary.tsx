import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { children } = (this as any).props;
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-[40px] shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-black text-white mb-2">Algo salió mal</h2>
            <p className="text-zinc-500 text-xs font-bold mb-6">
              Ha ocurrido un error inesperado. Por favor intenta recargar la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-white text-black rounded-[24px] text-xs font-black uppercase tracking-widest"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
