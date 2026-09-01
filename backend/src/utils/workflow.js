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
        Submitted: ['Under Review', 'Pending Approval', 'Approved', 'Rejected', 'Recount Required'],
        'Under Review': ['Approved', 'Rejected', 'Recount Required', 'Variance Detected'],
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
        Flagged: ['Requested', 'Pending Review', 'Approved', 'Rejected'],
        Requested: ['Pending Review', 'Approved', 'Rejected'],
        Pending: ['Pending Review', 'Approved', 'Rejected', 'Returned for Correction'],
        'Pending Review': ['Approved', 'Rejected', 'Returned for Correction'],
        'Returned for Correction': ['Pending Review', 'Requested'],
        Approved: ['Executed']
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

module.exports = { TRANSITIONS, assertTransition };