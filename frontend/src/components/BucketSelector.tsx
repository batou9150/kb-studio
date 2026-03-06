import React from 'react';
import { ExternalLink } from 'lucide-react';

interface BucketSelectorProps {
  bucketNames: string[];
  selectedBucket: string;
  onBucketChange: (bucket: string) => void;
  projectId: string;
  gcsConsoleTitle?: string;
}

export const BucketSelector: React.FC<BucketSelectorProps> = ({
  bucketNames, selectedBucket, onBucketChange, projectId, gcsConsoleTitle = 'Open in GCS console',
}) => {
  if (!selectedBucket) return null;

  return (
    <>
      {bucketNames.length > 1 ? (
        <select
          className="bucket-select"
          value={selectedBucket}
          onChange={(e) => onBucketChange(e.target.value)}
        >
          {bucketNames.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      ) : (
        <span className="bucket-name">{selectedBucket}</span>
      )}
      {projectId && (
        <a
          className="icon-btn"
          href={`https://console.cloud.google.com/storage/browser/${selectedBucket}?project=${projectId}`}
          target="_blank"
          rel="noopener noreferrer"
          title={gcsConsoleTitle}
        >
          <ExternalLink size={16} />
        </a>
      )}
    </>
  );
};
