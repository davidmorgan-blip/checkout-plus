import React from 'react';
import { TextField, Autocomplete } from '@mui/material';

interface MerchantFilterAutocompleteProps {
  merchants: string[];
  value: string | null;
  onChange: (event: any, newValue: string | null) => void;
  size?: 'small' | 'medium';
  minWidth?: number;
}

/**
 * Reusable merchant filter autocomplete component
 * Provides search/filter functionality for merchant names
 */
export const MerchantFilterAutocomplete: React.FC<MerchantFilterAutocompleteProps> = ({
  merchants,
  value,
  onChange,
  size = 'medium',
  minWidth = 250,
}) => {
  return (
    <Autocomplete
      size={size}
      sx={{ minWidth }}
      options={merchants}
      value={value}
      onChange={onChange}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Filter by Merchant"
          placeholder="Search merchants..."
        />
      )}
      clearOnBlur={false}
      clearOnEscape
      freeSolo={false}
    />
  );
};
