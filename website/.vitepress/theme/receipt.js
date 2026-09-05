export function receiptHeading(receipt) {
  if (receipt?.outcomeUncertain || receipt?.state === 'uncertain') return 'Check before retrying.';
  if (receipt?.code === 'added') return receipt.queueVerified === true ? 'Enqueue confirmed.' : 'Queue not verified.';
  return { checking: 'Checking your song…', received: 'Request received.', sending: 'Sending…' }[receipt?.state] || 'Request not added.';
}

export function needsQueueCheck(receipt) {
  return receipt?.outcomeUncertain || receipt?.state === 'uncertain' || (receipt?.code === 'added' && receipt.queueVerified !== true);
}
