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
        Draft: ['Submitted', 'Pending Review', 'Approved', 'Rejected'],
        Submitted: ['Pending Review', 'Approved', 'Rejected'],
        Pending: ['Approved', 'Rejected'],
        'Pending Review': ['Approved', 'Rejected'],
        Approved: ['Returned to Stock']
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
        Draft: ['Submitted'],
        Submitted: ['Pending Approval', 'Approved', 'Rejected', 'Recount Required'],
        'Recount Required': ['Submitted'],
        'Pending Approval': ['Approved', 'Rejected'],
        Approved: ['Posted'],
        Posted: ['Closed']
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