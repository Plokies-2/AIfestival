import React from 'react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: string;
  symbol: string;
  companyName: string;
  isLoading: boolean;
}

const ReportModal: React.FC<ReportModalProps> = ({ 
  isOpen, 
  onClose, 
  report, 
  symbol, 
  companyName, 
  isLoading 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                SpeedTraffic™ 분석 보고서
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {companyName} ({symbol})
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-slate-600">AI가 분석 보고서를 생성하고 있습니다...</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <div className="whitespace-pre-wrap text-slate-800 leading-relaxed text-sm">
                  {report}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <div className="text-xs text-slate-500">
              AI 기반 분석 결과는 참고용이며, 투자 결정 시 신중한 검토가 필요합니다.
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
