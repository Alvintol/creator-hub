import { HubActionsContext, HubStateContext } from '../../providers/hub/HubProvider';
import type { HubActions, HubState } from '../../providers/hub';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FavouritesButton from '../FavouriteButton';

const mockSetFilters = vi.fn();
const mockResetFilters = vi.fn();
const mockRefreshFavourites = vi.fn();
const mockToggleFavouriteCreator = vi.fn();
const mockToggleFavouriteListing = vi.fn();
