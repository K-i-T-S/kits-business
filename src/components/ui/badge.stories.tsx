import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Badge } from './badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A small, customizable badge component for displaying status, categories, or metadata. Built with Radix UI primitives.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'The visual style variant of the badge',
    },
    children: {
      control: 'text',
      description: 'The content inside the badge',
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Badge',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Error',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const StatusBadges: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge className="bg-green-500">Active</Badge>
      <Badge className="bg-yellow-500">Pending</Badge>
      <Badge className="bg-red-500">Inactive</Badge>
      <Badge className="bg-blue-500">New</Badge>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge className="flex items-center gap-1">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        Online
      </Badge>
      <Badge className="flex items-center gap-1">
        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
        Away
      </Badge>
      <Badge className="flex items-center gap-1">
        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
        Offline
      </Badge>
    </div>
  ),
};

export const CountBadges: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="secondary">1</Badge>
      <Badge variant="secondary">23</Badge>
      <Badge variant="secondary">99+</Badge>
      <Badge variant="destructive">5</Badge>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [selected, setSelected] = React.useState('option1');

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Selected: {selected}</p>
        <div className="flex gap-2">
          {['option1', 'option2', 'option3'].map((option) => (
            <Badge
              key={option}
              variant={selected === option ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelected(option)}
            >
              {option}
            </Badge>
          ))}
        </div>
      </div>
    );
  },
};
