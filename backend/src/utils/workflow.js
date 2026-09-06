const AppError = require('./AppError');

const TRANSITIONS = {
    goodsReceipt: {
        Draft: ['Submitted', 'Pending'],
        Submitted: ['Pending Evaluation', 'Under Evaluation'],
        Pending: ['Pending Evaluation', 'Under Evaluation'],
        'Pending Evaluation': ['Under Evaluation'],
        'Under Evaluation': ['Accepted', 'Partially Accepted', 'Rejected'],
        Accepted: ['GRN Generated'],
        'Partially Accepted': ['GRN Generated'],
        'GRN Generated': ['Posted'],
        Posted: []
    },
    requisition: {
        Draft: ['Submitted', 'Pending', 'Approved', 'Partially Approved', 'Rejected'],
        Submitted: ['Pending Approval', 'Approved', 'Partially Approved', 'Rejected', 'Returned for Correction'],
        Pending: ['Approved', 'Partially Approved', 'Rejected', 'Returned for Correction'],
        'Pending Approval': ['Approved', 'Partially Approved', 'Rejected', 'Returned for Correction'],
        'Returned for Correction': ['Submitted', 'Pending']
    },
    materialReturn: {
        Draft: ['Submitted'],
        Submitted: ['Approved', 'Rejected', 'Returned for Correction', 'Pending Review'],
        Pending: ['Approved', 'Rejected', 'Returned for Correction'],
        'Pending Review': ['Approved', 'Rejected', 'Returned for Correction'],
        'Returned for Correction': ['Submitted'],
        Approved: ['Under Receiving', 'Rejected'],
        'Under Receiving': ['Fully Accepted', 'Partially Accepted', 'Return Rejected'],
        'Fully Accepted': ['Returned to Stock'],
        'Partially Accepted': ['Returned to Stock'],
        'Return Rejected': [],
        Rejected: [],
        'Returned to Stock': []
    },
    materialTransfer: {
        Draft: ['Submitted', 'Pending', 'Pending Approval', 'Approved', 'Rejected'],
        Submitted: ['Pending Approval', 'Approved', 'Rejected', 'Returned for Correction'],
        Pending: ['Pending Approval', 'Approved', 'Rejected', 'Returned for Correction'],
        'Pending Approval': ['Approved', 'Rejected', 'Returned for Correction'],
        'Returned for Correction': ['Pending Approval', 'Submitted'],
        Approved: ['Dispatched'],
        Dispatched: ['Received']
    },
    stockTaking: {
        Draft: ['Scheduled', 'Submitted'],
        Scheduled: ['In Progress', 'Submitted'],
        'In Progress': ['Submitted', 'Recount Required'],
        Submitted: ['Under Review', 'Pending Approval', 'Approved', 'Rejected', 'Recount Required', 'Closed'],
        'Under Review': ['Approved', 'Rejected', 'Recount Required', 'Variance Detected', 'Pending Approval', 'Closed'],
        'Recount Required': ['Submitted', 'In Progress'],
        'Variance Detected': ['Investigation', 'Rejected'],
        Investigation: ['Adjustment Proposed', 'Rejected'],
        'Adjustment Proposed': ['Approved', 'Rejected'],
        'Pending Approval': ['Approved', 'Rejected', 'Variance Detected'],
        Approved: ['Posted'],
        Rejected: [],
        Posted: ['Closed'],
        Closed: []
    },
    disposal: {
        Flagged: ['Quarantined'],
        Quarantined: ['Under Technical Assessment'],
        'Under Technical Assessment': ['Repairable', 'Unusable', 'Returned to Stock'],
        Repairable: ['Send for Repair'],
        'Send for Repair': ['Under Technical Assessment', 'Returned to Stock'],
        'Returned to Stock': [],
        Unusable: ['Disposal Requested', 'Requested'],
        'Disposal Requested': ['Pending Store Head Review', 'Store Head Review'],
        'Pending Store Head Review': ['Store Head Review'],
        'Store Head Review': ['Recommended for Disposal', 'Returned for Correction'],
        'Recommended for Disposal': ['Pending Authorization'],
        'Pending Authorization': ['Ready for Disposal', 'Rejected', 'Returned for Correction'],
        'Ready for Disposal': ['Disposed'],
        Disposed: ['Pending Confirmation'],
        'Pending Confirmation': ['Confirmed'],
        Confirmed: ['Posted'],
        Posted: ['Completed'],
        Requested: ['Pending Review', 'Approved', 'Rejected'],
        Pending: ['Pending Review', 'Approved', 'Rejected', 'Returned for Correction'],
        'Pending Review': ['Approved', 'Rejected', 'Returned for Correction'],
        'Returned for Correction': ['Requested', 'Pending Review'],
        Approved: ['Executed'],
        Executed: ['Completed'],
        Completed: ['Closed'],
        Rejected: [],
        Closed: []
    },
    issueVoucher: {
        Preliminary: ['Pending Approval', 'Approved'],
        'Pending Approval': ['Approved', 'Rejected'],
        Approved: ['Posted']
    }
};

function assertTransition(workflow, currentStatus, nextStatus) {
    const allowed = TRANSITIONS[workflow]?.[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
        throw new AppError(
            `Invalid ${workflow} transition from "${currentStatus}" to "${nextStatus}".`,
            409
        );
    }
}

function canEditStockTakingCounts(status) {
    return ['Draft', 'Scheduled', 'In Progress', 'Recount Required'].includes(status);
}

function isOpenStockTakingSession(status) {
    return ['Draft', 'Scheduled', 'In Progress', 'Submitted', 'Under Review', 'Recount Required', 'Variance Detected', 'Investigation', 'Adjustment Proposed', 'Pending Approval', 'Approved'].includes(status);
}

module.exports = { TRANSITIONS, assertTransition, canEditStockTakingCounts, isOpenStockTakingSession };