import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Button } from './ui/button';

const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'ErrorBoundary catches JavaScript errors in their child component tree, logs those errors, and displays a fallback UI instead of crashing the entire application.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// Normal component that works fine
const WorkingComponent = () => (
  <div className="p-4 border rounded-md">
    <h3 className="text-lg font-semibold mb-2">Working Component</h3>
    <p>This component renders without any errors.</p>
    <Button className="mt-2">Click me</Button>
  </div>
);

// Component that throws an error
const ThrowingComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('This is a test error for demonstration purposes.');
  }
  
  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-semibold mb-2">Error Throwing Component</h3>
      <p>This component will throw an error when shouldThrow is true.</p>
      <Button className="mt-2">This button won't render when error occurs</Button>
    </div>
  );
};

export const Default: Story = {
  args: {
    children: <WorkingComponent />
  },
};

export const WithError: Story = {
  args: {
    children: <ThrowingComponent shouldThrow={true} />
  },
};

export const WithCustomFallback: Story = {
  args: {
    children: <ThrowingComponent shouldThrow={true} />,
    fallback: (
      <div className="p-6 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-red-800 font-semibold mb-2">Custom Error Fallback</h3>
        <p className="text-red-600">Something went wrong, but here's a custom error message!</p>
      </div>
    )
  },
};

export const WithErrorHandler: Story = {
  args: {
    children: <ThrowingComponent shouldThrow={true} />,
    onError: (error, errorInfo) => {
      console.log('Custom error handler called:', error.message);
      console.log('Error info:', errorInfo);
    }
  },
};

// Interactive story where user can trigger the error
export const Interactive: Story = {
  args: {
    children: (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="destructive">
            Trigger Error
          </Button>
          <Button variant="outline">
            Reset Error
          </Button>
        </div>
        <div className="p-4 border rounded-md">
          <h3 className="text-lg font-semibold mb-2">Interactive Component</h3>
          <p>This component demonstrates error boundary behavior.</p>
        </div>
      </div>
    )
  }
};
