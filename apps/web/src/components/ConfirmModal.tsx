"use client";

import { useEffect, useState } from "react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    tone?: "danger" | "info" | "warning";
    requireConfirmationText?: string;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    onConfirm,
    onCancel,
    tone = "info",
    requireConfirmationText,
}: ConfirmModalProps) {
    const [mounted, setMounted] = useState(false);
    const [confirmationInput, setConfirmationInput] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset input when modal closes/opens
    useEffect(() => {
        if (!isOpen) setConfirmationInput("");
    }, [isOpen]);

    if (!mounted || !isOpen) return null;

    const isConfirmDisabled = requireConfirmationText
        ? confirmationInput.trim() !== requireConfirmationText.trim()
        : false;

    const colors = {
        danger: "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300",
        warning: "bg-amber-500 hover:bg-amber-600 text-white disabled:bg-amber-300",
        info: "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300",
    };

    // ... (icons remain same code)
    const icons = {
        danger: (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
        ),
        warning: (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </div>
        ),
        info: (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            </div>
        ),
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onCancel}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    {icons[tone]}

                    <h3 className="mt-4 text-xl font-bold text-gray-900">{title}</h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                        {message}
                    </p>

                    {requireConfirmationText && (
                        <div className="mt-6 w-full text-left">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Escribí <span className="text-gray-900 font-bold">"{requireConfirmationText}"</span> para confirmar:
                            </label>
                            <input
                                autoFocus
                                value={confirmationInput}
                                onChange={(e) => setConfirmationInput(e.target.value)}
                                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-medium"
                                placeholder={requireConfirmationText}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isConfirmDisabled) onConfirm();
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className="mt-8 flex flex-col gap-2 sm:flex-row-reverse sm:gap-3">
                    <button
                        onClick={onConfirm}
                        disabled={isConfirmDisabled}
                        className={`inline-flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:active:scale-100 ${colors[tone]}`}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        onClick={onCancel}
                        className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
