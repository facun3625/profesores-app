"use client";

import { Component, ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);

        // Aquí podrías enviar el error a un servicio de logging como Sentry
        // Example: Sentry.captureException(error);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
                    <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-lg">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <svg
                                className="h-6 w-6 text-red-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        <h2 className="text-xl font-semibold text-gray-900">
                            Algo salió mal
                        </h2>

                        <p className="mt-2 text-sm text-gray-600">
                            Lo sentimos, ocurrió un error inesperado. Por favor, intenta recargar la página.
                        </p>

                        {process.env.NODE_ENV === "development" && this.state.error && (
                            <details className="mt-4 rounded-lg bg-gray-50 p-4">
                                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                                    Detalles del error (solo en desarrollo)
                                </summary>
                                <pre className="mt-2 overflow-auto text-xs text-red-600">
                                    {this.state.error.message}
                                    {"\n"}
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            Recargar página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
