export const formatDateTimeLocalForBackend = (value) => {
  if (!value) return '';
  const [datePart, timePart = '00:00'] = String(value).split('T');
  if (!datePart) return '';
  const normalizedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${datePart} ${normalizedTime}`;
};

export const getUNSTimeRangeError = (timeConfig) => {
  if (
    !timeConfig ||
    (timeConfig.timeMode || 'relative') !== 'absolute' ||
    !timeConfig.startTime ||
    !timeConfig.endTime
  ) {
    return '';
  }

  const startTime = Date.parse(timeConfig.startTime);
  const endTime = Date.parse(timeConfig.endTime);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < endTime) {
    return '';
  }

  return 'Start time must be before end time.';
};

export const formatUNSTimeRangeLabel = ({
  timeMode = 'relative',
  timeRangeValue = 5,
  timeRangeUnit = 'minute',
  startTime = '',
  endTime = '',
  periodReferenceTime = '',
} = {}) => {
  if (timeMode === 'absolute') {
    return `${startTime || 'start'} to ${endTime || 'end'}`;
  }

  if (timeMode === 'period') {
    const unitLabel = `${timeRangeUnit}${Number(timeRangeValue) !== 1 ? 's' : ''}`;
    const parts = [
      'Period',
      `Reference: ${periodReferenceTime || 'now()'}`,
      `Interval: ${timeRangeValue || 1} ${unitLabel}`,
    ];
    return parts.join(' | ');
  }

  return `Last ${timeRangeValue} ${timeRangeUnit}${Number(timeRangeValue) !== 1 ? 's' : ''}`;
};
