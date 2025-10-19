import { XMarkIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useRef } from 'react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmButtonClass = 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    isLoading = false
}) => {
    const modalRef = useRef(null);
    const confirmButtonRef = useRef(null);
    const cancelButtonRef = useRef(null);
    const previousActiveElement = useRef(null);

    // Focus management and keyboard handling
    useEffect(() => {
        if (isOpen) {
            // Store the previously focused element
            previousActiveElement.current = document.activeElement;

            // Focus the modal
            modalRef.current?.focus();

            // Prevent body scroll
            document.body.style.overflow = 'hidden';

            return () => {
                // Restore body scroll
                document.body.style.overflow = 'unset';

                // Return focus to the previously focused element
                if (previousActiveElement.current) {
                    previousActiveElement.current.focus();
                }
            };
        }
    }, [isOpen]);

    // Handle keyboard events
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter' && !isLoading) {
            onConfirm();
        } else if (e.key === 'Tab') {
            // Trap focus within the modal
            const focusableElements = modalRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (focusableElements && focusableElements.length > 0) {
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        }
    };

    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto"
            onClick={handleBackdropClick}
        >
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div
                    className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                    aria-hidden="true"
                />

                {/* Modal panel */}
                <div
                    ref={modalRef}
                    className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                    aria-describedby="modal-description"
                    tabIndex={-1}
                    onKeyDown={handleKeyDown}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3
                            id="modal-title"
                            className="text-lg font-semibold text-gray-900"
                        >
                            {title}
                        </h3>
                        <button
                            ref={cancelButtonRef}
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                            disabled={isLoading}
                            aria-label="Close modal"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4">
                        <p
                            id="modal-description"
                            className="text-sm text-gray-600"
                        >
                            {message}
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
                        <button
                            ref={cancelButtonRef}
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            disabled={isLoading}
                        >
                            {cancelText}
                        </button>
                        <button
                            ref={confirmButtonRef}
                            type="button"
                            onClick={onConfirm}
                            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClass}`}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Processing...' : confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
