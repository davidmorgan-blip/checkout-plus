import React from 'react';
import { TableCell, Typography, Link, Box } from '@mui/material';

interface ExcludeCheckboxColumnProps {
  onSelectAll: () => void;
  onClearAll: () => void;
}

/**
 * Reusable table header cell for merchant exclusion checkboxes
 * Provides "All" and "None" links for bulk selection
 */
export const ExcludeCheckboxColumn: React.FC<ExcludeCheckboxColumnProps> = ({
  onSelectAll,
  onClearAll,
}) => {
  return (
    <TableCell padding="checkbox">
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption">Exclude</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Link
            component="button"
            variant="caption"
            onClick={onSelectAll}
            sx={{ cursor: 'pointer' }}
          >
            All
          </Link>
          <Typography variant="caption">|</Typography>
          <Link
            component="button"
            variant="caption"
            onClick={onClearAll}
            sx={{ cursor: 'pointer' }}
          >
            None
          </Link>
        </Box>
      </Box>
    </TableCell>
  );
};
