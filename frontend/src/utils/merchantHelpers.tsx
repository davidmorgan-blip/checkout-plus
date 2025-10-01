import React from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';

/**
 * Renders a merchant name with clickable links to Salesforce Account and Opportunity records
 * @param merchantName - The merchant's display name
 * @param accountId - Salesforce Account ID
 * @param opportunityId - Salesforce Opportunity ID
 * @param additionalInfo - Optional additional information to display below the name (e.g., "Rev Share • MPL")
 * @returns JSX element with merchant name and SFDC links
 */
export const renderMerchantWithLinks = (
  merchantName: string,
  accountId: string,
  opportunityId: string,
  additionalInfo?: string
) => (
  <Box>
    <Box display="flex" alignItems="center" gap={0.5}>
      <Typography variant="body2" fontWeight="medium">
        {merchantName}
      </Typography>
      <Tooltip title="View SFDC Account">
        <IconButton
          size="small"
          sx={{ padding: '2px' }}
          onClick={() => window.open(`https://loopreturn.lightning.force.com/lightning/r/Account/${accountId}/view`, '_blank')}
        >
          <LaunchIcon sx={{ fontSize: 12, color: 'primary.main' }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="View SFDC Opportunity">
        <IconButton
          size="small"
          sx={{ padding: '2px' }}
          onClick={() => window.open(`https://loopreturn.lightning.force.com/lightning/r/Opportunity/${opportunityId}/view`, '_blank')}
        >
          <LaunchIcon sx={{ fontSize: 12, color: 'secondary.main' }} />
        </IconButton>
      </Tooltip>
    </Box>
    {additionalInfo && (
      <Typography variant="caption" color="textSecondary">
        {additionalInfo}
      </Typography>
    )}
  </Box>
);
