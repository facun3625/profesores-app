"use client";

import { useState } from "react";

export type PdfOptions = {
    boldStatement: boolean;
    fontFamily: "Calibri" | "Times New Roman" | "Arial";
    questionSize: 9 | 10 | 11 | 12 | 14;
    answerSize: 9 | 10 | 11 | 12 | 14;
    lineSpacing: 1.0 | 1.5;
};

type PdfCustomizeModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onDownload: (options: PdfOptions) => void;
};

export default function PdfCustomizeModal({
    isOpen,
    onClose,
    onDownload,
}: PdfCustomizeModalProps) {
    const [options, setOptions] = useState<PdfOptions>({
        boldStatement: false,
        fontFamily: "Calibri",
        questionSize: 12,
        answerSize: 11,
        lineSpacing: 1.0,
    });

    if (!isOpen) return null;

    function handleDownload() {
        onDownload(options);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Personalizar formato del PDF
                </h2>

                <div className="space-y-4 mb-6">
                    {/* Enunciado en negrita */}
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={options.boldStatement}
                            onChange={(e) =>
                                setOptions({ ...options, boldStatement: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        />
                        <span className="text-sm text-gray-700">Enunciado en negrita</span>
                    </label>

                    {/* Tipografía */}
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Tipografía</span>
                        <select
                            value={options.fontFamily}
                            onChange={(e) =>
                                setOptions({
                                    ...options,
                                    fontFamily: e.target.value as PdfOptions["fontFamily"],
                                })
                            }
                            className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="Calibri">Calibri</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Arial">Arial</option>
                        </select>
                    </label>

                    {/* Tamaño pregunta */}
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">
                            Tamaño de pregunta
                        </span>
                        <select
                            value={options.questionSize}
                            onChange={(e) =>
                                setOptions({
                                    ...options,
                                    questionSize: +e.target.value as PdfOptions["questionSize"],
                                })
                            }
                            className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="9">9</option>
                            <option value="10">10</option>
                            <option value="11">11</option>
                            <option value="12">12</option>
                            <option value="14">14</option>
                        </select>
                    </label>

                    {/* Tamaño respuesta */}
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">
                            Tamaño de respuesta
                        </span>
                        <select
                            value={options.answerSize}
                            onChange={(e) =>
                                setOptions({
                                    ...options,
                                    answerSize: +e.target.value as PdfOptions["answerSize"],
                                })
                            }
                            className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="9">9</option>
                            <option value="10">10</option>
                            <option value="11">11</option>
                            <option value="12">12</option>
                            <option value="14">14</option>
                        </select>
                    </label>

                    {/* Interlineado */}
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Interlineado</span>
                        <select
                            value={options.lineSpacing}
                            onChange={(e) =>
                                setOptions({
                                    ...options,
                                    lineSpacing: +e.target.value as PdfOptions["lineSpacing"],
                                })
                            }
                            className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="1.0">Sencillo (1.0)</option>
                            <option value="1.5">1.5</option>
                        </select>
                    </label>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                    >
                        Descargar PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
