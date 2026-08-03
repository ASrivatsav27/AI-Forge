type Props = {
  port: string | null;
};

const ProjectPreview = ({ port }: Props) => {
  if (!port) {
    return (
      <div className="flex h-full items-center justify-center">
        Waiting for preview...
      </div>
    );
  }

  return (
    <iframe
      src={`http://localhost:${port}`}
      title="Project Preview"
      className="h-full w-full border-0"
    />
  );
};

export default ProjectPreview;