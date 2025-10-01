import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';

interface DaysLiveFilterProps {
  value: string;
  onChange: (value: string) => void;
  size?: 'small' | 'medium';
  minWidth?: number;
}

/**
 * Reusable days live filter dropdown component
 * Provides standard filtering options for merchant days live
 */
export const DaysLiveFilter: React.FC<DaysLiveFilterProps> = ({
  value,
  onChange,
  size = 'medium',
  minWidth = 200,
}) => {
  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel>Days Live Filter</InputLabel>
      <Select
        value={value}
        label="Days Live Filter"
        onChange={handleChange}
      >
        <MenuItem value="all">All Merchants</MenuItem>
        <MenuItem value="under30">&lt;30 Days Live</MenuItem>
        <MenuItem value="30-60">30-60 Days Live</MenuItem>
        <MenuItem value="30">30+ Days Live</MenuItem>
        <MenuItem value="60">60+ Days Live</MenuItem>
        <MenuItem value="90">90+ Days Live</MenuItem>
      </Select>
    </FormControl>
  );
};
